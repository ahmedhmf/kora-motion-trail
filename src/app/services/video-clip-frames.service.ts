import { inject, Injectable } from '@angular/core';
import { YoloSegmentationService } from './yolo-segmentation.service';
import { MotionTrailsService } from './motion-trails.service';
import { MotionSettings } from '../models/motion-settings.model';

export const CLIP_MAX_SECONDS = 5;
export const CLIP_FPS = 6;
export const CLIP_MAX_EDGE = 480;

export interface SegmentedClipFrame {
  source: HTMLCanvasElement;
  player: HTMLCanvasElement;
  ball: HTMLCanvasElement | null;
  combined: HTMLCanvasElement;
  timeSeconds: number;
}

export function getClipSampleTimes(duration: number, fps = CLIP_FPS): number[] {
  if (!Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(fps) || fps <= 0) {
    throw new Error('Video length and frame rate must be positive.');
  }
  const seconds = Math.min(duration, CLIP_MAX_SECONDS);
  const count = Math.max(1, Math.ceil(seconds * fps));
  return Array.from({ length: count }, (_, index) =>
    Math.min(index / fps, Math.max(0, duration - 0.001)));
}

export function getClipDimensions(width: number, height: number): {
  width: number; height: number;
} {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width < 1 || height < 1) throw new Error('Invalid video dimensions.');
  const ratio = Math.min(1, CLIP_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

@Injectable({ providedIn: 'root' })
export class VideoClipFramesService {
  private readonly yolo = inject(YoloSegmentationService);
  private readonly trails = inject(MotionTrailsService);

  async process(
    video: HTMLVideoElement,
    onProgress: (fraction: number) => void,
    cancelled: () => boolean,
  ): Promise<SegmentedClipFrame[]> {
    const dimensions = getClipDimensions(video.videoWidth, video.videoHeight);
    const times = getClipSampleTimes(video.duration);
    const result: SegmentedClipFrame[] = [];

    for (let i = 0; i < times.length; i++) {
      if (cancelled()) throw new Error('Video processing was cancelled.');
      await this.seek(video, times[i]);
      if (cancelled()) throw new Error('Video processing was cancelled.');

      const source = document.createElement('canvas');
      source.width = dimensions.width;
      source.height = dimensions.height;
      const ctx = source.getContext('2d');
      if (!ctx) throw new Error('Could not read video frame.');
      ctx.drawImage(video, 0, 0, source.width, source.height);
      // The model is shared and cached by YoloSegmentationService.
      const masks = await this.yolo.generateSubjectMasks(source, true);
      if (cancelled()) throw new Error('Video processing was cancelled.');
      result.push({
        source, player: masks.player, ball: masks.ball,
        combined: masks.combined, timeSeconds: times[i],
      });
      onProgress((i + 1) / times.length);
      // Let the browser update the UI between inference calls.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return result;
  }

  render(
    frame: SegmentedClipFrame,
    playerSettings: MotionSettings,
    ballSettings: MotionSettings,
  ): HTMLCanvasElement {
    return this.trails.render(
      frame.source, frame.player, playerSettings, frame.ball, ballSettings,
    );
  }

  async exportWebm(
    frames: readonly SegmentedClipFrame[],
    playerSettings: MotionSettings,
    ballSettings: MotionSettings,
    onProgress: (fraction: number) => void,
  ): Promise<void> {
    if (!frames.length) throw new Error('Process a clip before exporting it.');
    if (typeof MediaRecorder === 'undefined' ||
        !HTMLCanvasElement.prototype.captureStream) {
      throw new Error('This browser does not support canvas video recording.');
    }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('WebM export is not supported by this browser.');

    const canvas = document.createElement('canvas');
    canvas.width = frames[0].source.width;
    canvas.height = frames[0].source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create export canvas.');

    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
      requestFrame?: () => void;
    };
    if (typeof track?.requestFrame !== 'function') {
      stream.getTracks().forEach((item) => item.stop());
      throw new Error('Manual frame recording requires a compatible browser.');
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime, videoBitsPerSecond: 4_000_000,
      });
    } catch (error) {
      stream.getTracks().forEach((item) => item.stop());
      throw error;
    }

    const chunks: Blob[] = [];
    const complete = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      recorder.onerror = () => reject(new Error('Video encoding failed.'));
      recorder.onstop = () => chunks.length
        ? resolve(new Blob(chunks, { type: mime }))
        : reject(new Error('No encoded video frames were produced.'));
    });

    // This is a short, SILENT WebM at the processing frame rate, not a copy
    // of the original source audio/container.
    try {
      recorder.start();
      const start = performance.now();
      for (let i = 0; i < frames.length; i++) {
        const delay = start + i * (1000 / CLIP_FPS) - performance.now();
        if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
        const rendered = this.render(frames[i], playerSettings, ballSettings);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(rendered, 0, 0);
        track.requestFrame();
        onProgress((i + 1) / frames.length);
      }
      // Capture a full final-frame interval before stopping the recorder.
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 / CLIP_FPS));
    } finally {
      if (recorder.state !== 'inactive') recorder.stop();
    }

    try {
      const blob = await complete;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'football-art-lab-video-beta.webm';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      stream.getTracks().forEach((item) => item.stop());
    }
  }

  private async seek(video: HTMLVideoElement, time: number): Promise<void> {
    if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out seeking a video frame.'));
      }, 10000);
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
      const onSeeked = () => { cleanup(); resolve(); };
      const onError = () => {
        cleanup();
        reject(new Error('Unable to decode a video frame.'));
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.currentTime = time;
    });
  }
}

import { Injectable } from '@angular/core';

import { MotionAnimationService } from './motion-animation.service';

import { MotionSettings } from '../models/motion-settings.model';

import { VideoExportSettings } from '../models/video-export-settings.model';
import { drawExportFrame, getExportDimensions } from './export-layout';

@Injectable({
  providedIn: 'root',
})
export class VideoExportService {
  constructor(private animationService: MotionAnimationService) {}

  async exportVideo(
    image: HTMLImageElement,
    mask: HTMLCanvasElement,
    motionSettings: MotionSettings,
    videoSettings: VideoExportSettings,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
      throw new Error('Video recording is not supported by this browser.');
    }

    const mimeType = this.getMimeType(videoSettings.format);

    if (!mimeType) {
      throw new Error(
        `${videoSettings.format.toUpperCase()} export ` + 'is not supported by this browser.',
      );
    }

    const { width, height } = getExportDimensions(
      image.naturalWidth,
      image.naturalHeight,
      videoSettings.resolution,
      videoSettings.aspectRatio,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not create video canvas.');
    }

    const stream = canvas.captureStream(0);

    const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
      requestFrame?: () => void;
    };

    if (typeof videoTrack.requestFrame !== 'function') {
      stream.getTracks().forEach((track) => track.stop());

      throw new Error('Manual canvas frame capture is not supported ' + 'by this browser.');
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 12_000_000,
    });

    const chunks: Blob[] = [];

    const recordingFinished = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        reject(new Error('Video recording failed.'));
      };

      recorder.onstop = () => {
        if (chunks.length === 0) {
          reject(new Error('No video data was recorded.'));
          return;
        }

        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    const durationMs = videoSettings.durationSeconds * 1000;

    const fps = videoSettings.fps;
    const totalFrames = Math.max(1, Math.round(videoSettings.durationSeconds * fps));

    const frameInterval = 1000 / fps;

    // Draw the first frame before recording starts.
    const firstFrame = this.animationService.renderFrame(
      image,
      mask,
      motionSettings,
      videoSettings,
      0,
    );

    drawExportFrame(ctx, firstFrame, firstFrame.width, firstFrame.height, width, height, videoSettings.fit);

    recorder.start();

    try {
      const recordingStart = performance.now();

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const targetTime = recordingStart + frameIndex * frameInterval;

        const waitMs = targetTime - performance.now();

        if (waitMs > 0) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, waitMs);
          });
        }

        const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;

        const frame = this.animationService.renderFrame(
          image,
          mask,
          motionSettings,
          videoSettings,
          progress,
        );

        drawExportFrame(ctx, frame, frame.width, frame.height, width, height, videoSettings.fit);

        videoTrack.requestFrame();

        onProgress?.((frameIndex + 1) / totalFrames);

        // Give the browser a chance to capture and encode.
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });
      }
    } finally {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }

    const blob = await recordingFinished;

    stream.getTracks().forEach((track) => track.stop());

    this.downloadVideo(blob, videoSettings.format, videoSettings.aspectRatio);
  }

  private getMimeType(format: VideoExportSettings['format']): string | null {
    const candidates =
      format === 'mp4'
        ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4']
        : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
  }

  private downloadVideo(
    blob: Blob,
    format: VideoExportSettings['format'],
    ratio: VideoExportSettings['aspectRatio'],
  ): void {
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = `football-motion-trails-${ratio.replace(':', 'x')}.${format}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

import {
  Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal,
} from '@angular/core';
import {
  CLIP_FPS, CLIP_MAX_SECONDS, SegmentedClipFrame, VideoClipFramesService,
} from '../../services/video-clip-frames.service';
import {
  DEFAULT_MOTION_SETTINGS, MotionSettings, TrailColorMode,
} from '../../models/motion-settings.model';
import { drawTrackingOverlay } from '../../services/tracking-overlay';
import { applyVideoCorrections, upsertCorrection, type VideoCorrectionKeyframe } from '../../services/video-correction-keyframes';
import type { TrackCenter } from '../../services/subject-tracking';
import {
  blankVideoMask, maskCenter, maskBrightness,
} from '../../services/video-mask-paint';
import {
  cloneBallMask, paintBallMaskStroke, type BallBrushMode,
} from '../../services/subject-masks';

type Subject = 'player' | 'ball';
type Preview = 'artwork' | 'source' | 'player' | 'ball' | 'combined';
type SliderKey = 'intensity' | 'layers' | 'trailStrength' | 'trailDistance' |
  'pathCurve' | 'echoRotation' | 'echoScale' | 'directionalBlur';

@Component({
  selector: 'app-video-lab',
  imports: [],
  templateUrl: './video-lab.html',
})
export class VideoLab implements OnDestroy {
  private readonly clips = inject(VideoClipFramesService);
  @ViewChild('previewCanvas') previewCanvas?: ElementRef<HTMLCanvasElement>;

  readonly maxSeconds = CLIP_MAX_SECONDS;
  readonly fps = CLIP_FPS;
  readonly name = signal<string | null>(null);
  readonly duration = signal(0);
  readonly frames = signal<SegmentedClipFrame[]>([]);
  readonly sourceFrames = signal<SegmentedClipFrame[]>([]);
  readonly corrections = signal<VideoCorrectionKeyframe[]>([]);
  readonly correcting = signal(false);
  readonly ballCorrectionRadius = signal(9);
  readonly correctionDraft = signal<TrackCenter | null>(null);
  private activeCorrectionPointer: number | null = null;
  readonly paintingMask = signal(false);
  readonly paintDraft = signal<HTMLCanvasElement | null>(null);
  readonly paintRevision = signal(0);
  readonly paintMode = signal<BallBrushMode>('add');
  readonly paintBrushSize = signal(18);
  readonly showPaintOverlay = signal(true);
  private paintPointerId: number | null = null;
  private lastPaintPoint: TrackCenter | null = null;
  readonly frameIndex = signal(0);
  readonly busy = signal(false);
  readonly exporting = signal(false);
  readonly progress = signal(0);
  readonly error = signal<string | null>(null);
  readonly activeSubject = signal<Subject>('player');
  readonly previewMode = signal<Preview>('artwork');
  readonly playerSettings = signal<MotionSettings>({ ...DEFAULT_MOTION_SETTINGS });
  readonly ballSettings = signal<MotionSettings>({ ...DEFAULT_MOTION_SETTINGS });
  readonly currentSettings = computed(() =>
    this.activeSubject() === 'player' ? this.playerSettings() : this.ballSettings());
  readonly playing = signal(false);
  readonly showTrackingOverlay = signal(true);
  readonly useOpticalFlow = signal(true);

  private video: HTMLVideoElement | null = null;
  private sourceUrl: string | null = null;
  private generation = 0;
  private raf: number | null = null;

  async onVideoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.stop();
    this.generation++;
    this.discardPaintDraft();
    this.video?.pause();
    this.video = null;
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = null;
    this.frames.set([]);
    this.sourceFrames.set([]);
    this.corrections.set([]);
    this.correcting.set(false);
    this.discardPaintDraft();
    this.correctionDraft.set(null);
    this.frameIndex.set(0);
    this.name.set(null);
    this.error.set(null);
    this.progress.set(0);
    this.duration.set(0);

    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      this.error.set('Please choose an MP4 or WebM video.');
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      this.error.set('Choose a video smaller than 80 MB for the beta editor.');
      return;
    }

    const generation = this.generation;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    this.sourceUrl = url;
    video.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Video loading timed out.')); }, 12000);
        const cleanup = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', loaded);
          video.removeEventListener('error', failed);
        };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Unable to decode this video.')); };
        video.addEventListener('loadedmetadata', loaded, { once: true });
        video.addEventListener('error', failed, { once: true });
      });
      if (generation !== this.generation) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0 ||
          !video.videoWidth || !video.videoHeight) {
        throw new Error('The clip has no valid video frames.');
      }
      this.video = video;
      this.name.set(file.name);
      this.duration.set(Math.min(CLIP_MAX_SECONDS, video.duration));
    } catch (error) {
      if (generation !== this.generation) return;
      this.error.set(error instanceof Error ? error.message : 'Unable to open video.');
      URL.revokeObjectURL(url);
      this.sourceUrl = null;
    }
  }

  async processClip(): Promise<void> {
    const video = this.video;
    if (!video || this.busy()) return;
    this.stop();
    this.busy.set(true);
    this.progress.set(0);
    this.error.set(null);
    this.frames.set([]);
    this.sourceFrames.set([]);
    this.corrections.set([]);
    this.correcting.set(false);
    this.discardPaintDraft();
    const generation = ++this.generation;
    try {
      const result = await this.clips.process(
        video, (fraction) => {
          if (generation === this.generation) this.progress.set(Math.round(100 * fraction));
        },
        () => generation !== this.generation,
      );
      if (generation !== this.generation) return;
      this.sourceFrames.set(result);
      this.frames.set(result);
      this.frameIndex.set(0);
      this.previewMode.set('artwork');
      this.drawCurrent();
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(error instanceof Error ? error.message : 'Video processing failed.');
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  cancelProcessing(): void {
    this.generation++;
    this.busy.set(false);
    this.progress.set(0);
    this.error.set(null);
  }

  private discardPaintDraft(): void {
    this.paintingMask.set(false);
    this.paintDraft.set(null);
    this.paintRevision.set(0);
    this.paintPointerId = null;
    this.lastPaintPoint = null;
  }

  startMaskPainting(): void {
    if (this.busy() || this.exporting() || !this.frames().length) return;
    this.stop();
    this.correcting.set(false);
    const frame = this.frames()[this.frameIndex()];
    const original = this.activeSubject() === 'ball' ? frame.ball : frame.player;
    this.paintDraft.set(original
      ? cloneBallMask(original)
      : blankVideoMask(frame.source.width, frame.source.height));
    this.paintRevision.set(0);
    this.paintingMask.set(true);
    this.showPaintOverlay.set(true);
    this.drawCurrent();
  }

  cancelMaskPainting(): void {
    this.discardPaintDraft();
    this.drawCurrent();
  }

  applyMaskPainting(): void {
    const draft = this.paintDraft();
    const frame = this.sourceFrames()[this.frameIndex()];
    if (!this.paintingMask() || !draft || !frame) return;
    const subject = this.activeSubject();
    const point = maskCenter(draft);
    if (!point) {
      this.error.set('The painted mask is empty. Add some subject pixels or cancel.');
      return;
    }
    this.corrections.update((keys) => upsertCorrection(keys, {
      subject, frame: this.frameIndex(), center: point,
      radius: this.ballCorrectionRadius(), paintedMask: cloneBallMask(draft),
    }));
    this.discardPaintDraft();
    this.error.set(null);
    this.rebuildCorrectedFrames();
  }

  setPaintMode(mode: BallBrushMode): void {
    this.paintMode.set(mode);
  }

  updatePaintBrushSize(event: Event): void {
    const size = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(size)) this.paintBrushSize.set(Math.max(2, Math.min(80, size)));
  }

  togglePaintOverlay(): void {
    this.showPaintOverlay.update((value) => !value);
    this.drawCurrent();
  }

  private strokeMask(from: TrackCenter, to: TrackCenter): void {
    const draft = this.paintDraft();
    if (!draft) return;
    paintBallMaskStroke(draft, from, to, this.paintBrushSize(), this.paintMode());
    this.paintRevision.update((n) => n + 1);
    this.drawCurrent();
  }

  private drawPaintOverlay(ctx: CanvasRenderingContext2D, frame: SegmentedClipFrame): void {
    const draft = this.paintDraft();
    if (!draft) return;
    ctx.drawImage(frame.source, 0, 0);
    if (!this.showPaintOverlay()) return;
    // Grayscale masks use opaque black as background; tint based on brightness,
    // never draw their opaque black background over the source video frame.
    const data = maskBrightness(draft);
    const tinted = document.createElement('canvas');
    tinted.width = draft.width;
    tinted.height = draft.height;
    const tint = tinted.getContext('2d');
    if (!tint) return;
    const pixels = tint.createImageData(tinted.width, tinted.height);
    for (let i = 0; i < data.length; i++) {
      pixels.data[i * 4] = this.activeSubject() === 'ball' ? 250 : 34;
      pixels.data[i * 4 + 1] = this.activeSubject() === 'ball' ? 204 : 211;
      pixels.data[i * 4 + 2] = this.activeSubject() === 'ball' ? 21 : 238;
      pixels.data[i * 4 + 3] = Math.round(data[i] * 0.55);
    }
    tint.putImageData(pixels, 0, 0);
    ctx.drawImage(tinted, 0, 0);
  }

  selectFrame(index: number): void {
    if (!this.frames().length || this.paintingMask()) return;
    this.stop();
    this.frameIndex.set(Math.max(0, Math.min(this.frames().length - 1, index)));
    this.drawCurrent();
  }

  stepFrame(direction: -1 | 1): void {
    this.selectFrame(this.frameIndex() + direction);
  }

  keyframeAt(index: number, subject: Subject): VideoCorrectionKeyframe | undefined {
    return this.corrections().find((key) => key.frame === index && key.subject === subject);
  }

  toggleCorrectionMode(): void {
    if (this.paintingMask()) return;
    this.stop();
    this.correcting.update((value) => !value);
    this.correctionDraft.set(null);
    this.drawCurrent();
  }

  updateBallCorrectionRadius(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.ballCorrectionRadius.set(Math.max(2, Math.min(50, value)));
  }

  removeCorrection(): void {
    const selected = this.frameIndex();
    const subject = this.activeSubject();
    this.corrections.update((items) => items.filter((key) =>
      key.frame !== selected || key.subject !== subject));
    this.rebuildCorrectedFrames();
  }

  clearCorrections(): void {
    this.corrections.set([]);
    this.rebuildCorrectedFrames();
  }

  private rebuildCorrectedFrames(): void {
    try {
      this.frames.set(applyVideoCorrections(
        this.sourceFrames(), this.corrections(), this.useOpticalFlow(),
      ));
      this.error.set(null);
    } catch (error) {
      // Keep the previous committed correction preview if flow computation
      // fails; allow turning it off rather than losing the clip.
      this.error.set(error instanceof Error ? error.message : 'Mask propagation failed.');
    }
    this.drawCurrent();
  }

  toggleOpticalFlow(): void {
    if (this.paintingMask() || this.exporting() || this.busy()) return;
    this.useOpticalFlow.update((enabled) => !enabled);
    this.rebuildCorrectedFrames();
  }

  private canvasPoint(event: PointerEvent): TrackCenter | null {
    const canvas = this.previewCanvas?.nativeElement;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height)),
    };
  }

  onCorrectionPointerDown(event: PointerEvent): void {
    if (this.paintingMask()) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const point = this.canvasPoint(event);
      if (!point) return;
      this.paintPointerId = event.pointerId;
      this.lastPaintPoint = point;
      this.previewCanvas?.nativeElement.setPointerCapture(event.pointerId);
      this.strokeMask(point, point);
      event.preventDefault();
      return;
    }
    if (!this.correcting() || !this.frames().length) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = this.canvasPoint(event);
    if (!point) return;
    this.stop();
    this.activeCorrectionPointer = event.pointerId;
    this.correctionDraft.set(point);
    this.previewCanvas?.nativeElement.setPointerCapture(event.pointerId);
    this.drawCurrent();
    event.preventDefault();
  }

  onCorrectionPointerMove(event: PointerEvent): void {
    if (this.paintingMask() && this.paintPointerId === event.pointerId &&
        this.lastPaintPoint) {
      const point = this.canvasPoint(event);
      if (!point) return;
      this.strokeMask(this.lastPaintPoint, point);
      this.lastPaintPoint = point;
      event.preventDefault();
      return;
    }
    if (this.activeCorrectionPointer !== event.pointerId) return;
    const point = this.canvasPoint(event);
    if (!point) return;
    this.correctionDraft.set(point);
    this.drawCurrent();
    event.preventDefault();
  }

  onCorrectionPointerUp(event: PointerEvent): void {
    if (this.paintingMask() && this.paintPointerId === event.pointerId) {
      this.paintPointerId = null;
      this.lastPaintPoint = null;
      const canvas = this.previewCanvas?.nativeElement;
      if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (this.activeCorrectionPointer !== event.pointerId) return;
    this.activeCorrectionPointer = null;
    const canvas = this.previewCanvas?.nativeElement;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.type === 'pointercancel') {
      this.correctionDraft.set(null);
      this.drawCurrent();
      return;
    }
    const point = this.canvasPoint(event) ?? this.correctionDraft();
    this.correctionDraft.set(null);
    if (!point) return;
    const frame = this.sourceFrames()[this.frameIndex()];
    if (!frame) return;
    if (this.activeSubject() === 'player' && !frame.tracking?.player.center) {
      this.error.set('Player not detected on this frame. Choose a frame where the player is visible.');
      this.drawCurrent();
      return;
    }
    const keyframe: VideoCorrectionKeyframe = {
      subject: this.activeSubject(),
      frame: this.frameIndex(),
      center: point,
      radius: this.ballCorrectionRadius(),
    };
    this.corrections.update((items) => upsertCorrection(items, keyframe));
    this.error.set(null);
    this.rebuildCorrectedFrames();
  }

  toggleTrackingOverlay(): void {
    this.showTrackingOverlay.update((value) => !value);
    this.drawCurrent();
  }

  currentTracking() {
    return this.frames()[this.frameIndex()]?.tracking ?? null;
  }

  selectSubject(value: Subject): void {
    if (this.paintingMask()) return;
    this.activeSubject.set(value);
    this.correctionDraft.set(null);
    this.drawCurrent();
  }

  setPreview(value: Preview): void {
    if (this.paintingMask()) return;
    this.previewMode.set(value);
    this.drawCurrent();
  }

  updateNumber(key: SliderKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    this.updateSettings({ [key]: value });
  }

  updateDirection(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.updateSettings({ directionAngle: value });
  }

  updateColorMode(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!['original', 'solid', 'gradient'].includes(value)) return;
    this.updateSettings({ trailColorMode: value as TrailColorMode });
  }

  updateColor(key: 'trailColor' | 'trailEndColor', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
    this.updateSettings({ [key]: value });
  }

  private updateSettings(changes: Partial<MotionSettings>): void {
    if (this.activeSubject() === 'player') {
      this.playerSettings.update((old) => ({ ...old, ...changes }));
    } else {
      this.ballSettings.update((old) => ({ ...old, ...changes }));
    }
    this.drawCurrent();
  }

  seek(event: Event): void {
    if (this.paintingMask()) return;
    this.stop();
    const index = Number((event.target as HTMLInputElement).value);
    if (!Number.isInteger(index)) return;
    this.frameIndex.set(Math.max(0, Math.min(this.frames().length - 1, index)));
    this.drawCurrent();
  }

  togglePlayback(): void {
    if (this.paintingMask()) return;
    if (this.playing()) { this.stop(); return; }
    const frames = this.frames();
    if (!frames.length) return;
    if (this.frameIndex() >= frames.length - 1) this.frameIndex.set(0);
    this.playing.set(true);
    const start = performance.now() - this.frameIndex() / CLIP_FPS * 1000;
    const animate = (now: number) => {
      if (!this.playing()) return;
      const next = Math.min(frames.length - 1,
        Math.floor((now - start) / 1000 * CLIP_FPS));
      if (next !== this.frameIndex()) {
        this.frameIndex.set(next);
        this.drawCurrent();
      }
      if (next >= frames.length - 1) { this.stop(); return; }
      this.raf = requestAnimationFrame(animate);
    };
    this.raf = requestAnimationFrame(animate);
  }

  stop(): void {
    this.playing.set(false);
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  async exportClip(): Promise<void> {
    if (!this.frames().length || this.exporting() || this.busy() || this.paintingMask()) return;
    this.stop();
    this.exporting.set(true);
    this.error.set(null);
    this.progress.set(0);
    try {
      await this.clips.exportWebm(
        this.frames(), this.playerSettings(), this.ballSettings(),
        (fraction) => this.progress.set(Math.round(100 * fraction)),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Video export failed.');
    } finally {
      this.exporting.set(false);
    }
  }

  drawCurrent(): void {
    const canvas = this.previewCanvas?.nativeElement;
    const frame = this.frames()[this.frameIndex()];
    if (!canvas || !frame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = frame.source.width;
    canvas.height = frame.source.height;
    const mode = this.previewMode();
    const selected = mode === 'source' ? frame.source
      : mode === 'player' ? frame.player
      : mode === 'ball' ? frame.ball
      : mode === 'combined' ? frame.combined
      : this.clips.render(frame, this.playerSettings(), this.ballSettings());
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (selected) ctx.drawImage(selected, 0, 0);
    if (this.paintingMask()) {
      this.drawPaintOverlay(ctx, frame);
      return;
    }
    if (this.showTrackingOverlay() && !this.correcting()) {
      drawTrackingOverlay(ctx, this.frames(), this.frameIndex(), canvas.width, canvas.height);
    }
    if (this.correcting()) {
      const subject = this.activeSubject();
      const position = this.correctionDraft()
        ?? this.keyframeAt(this.frameIndex(), subject)?.center
        ?? this.sourceFrames()[this.frameIndex()]?.tracking?.[subject].center;
      if (position) {
        ctx.save();
        ctx.strokeStyle = subject === 'ball' ? '#facc15' : '#22d3ee';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(position.x, position.y,
          subject === 'ball' ? this.ballCorrectionRadius() : 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(position.x - 14, position.y);
        ctx.lineTo(position.x + 14, position.y);
        ctx.moveTo(position.x, position.y - 14);
        ctx.lineTo(position.x, position.y + 14);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this.generation++;
    this.video?.pause();
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
  }
}

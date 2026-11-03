import {
  Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal,
} from '@angular/core';
import {
  CLIP_FPS, CLIP_MAX_SECONDS, SegmentedClipFrame, VideoClipFramesService,
} from '../../services/video-clip-frames.service';
import {
  DEFAULT_MOTION_SETTINGS, MotionSettings, TrailColorMode,
} from '../../models/motion-settings.model';

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
    this.video?.pause();
    this.video = null;
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = null;
    this.frames.set([]);
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
    const generation = ++this.generation;
    try {
      const result = await this.clips.process(
        video, (fraction) => {
          if (generation === this.generation) this.progress.set(Math.round(100 * fraction));
        },
        () => generation !== this.generation,
      );
      if (generation !== this.generation) return;
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

  selectSubject(value: Subject): void {
    this.activeSubject.set(value);
    this.drawCurrent();
  }

  setPreview(value: Preview): void {
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
    this.stop();
    const index = Number((event.target as HTMLInputElement).value);
    if (!Number.isInteger(index)) return;
    this.frameIndex.set(Math.max(0, Math.min(this.frames().length - 1, index)));
    this.drawCurrent();
  }

  togglePlayback(): void {
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
    if (!this.frames().length || this.exporting() || this.busy()) return;
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
  }

  ngOnDestroy(): void {
    this.stop();
    this.generation++;
    this.video?.pause();
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
  }
}

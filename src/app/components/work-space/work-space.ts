import { Component, inject, signal } from '@angular/core';
import { EditorStore } from '../../stores/editor.store';
import { MaskEditor } from '../mask-editor/mask-editor';
import { ArtworkCanvas } from '../artwork-canvas/artwork-canvas';
import {
  VideoExportSettings,
  DEFAULT_VIDEO_EXPORT_SETTINGS,
} from '../../models/video-export-settings.model';
import { MotionAnimationService } from '../../services/motion-animation.service';
import { getEffectiveDurationSeconds } from '../../services/animation-timing';
import { SideBar } from './side-bar/side-bar';

@Component({
  imports: [MaskEditor, ArtworkCanvas, SideBar],
  selector: 'app-work-space',
  styleUrl: './work-space.css',
  templateUrl: './work-space.html',
})
export class WorkSpace {
  readonly editorStore = inject(EditorStore);
  readonly animationService = inject(MotionAnimationService);
  readonly getEffectiveDurationSeconds = getEffectiveDurationSeconds;

  readonly isEditingMask = signal(false);
  readonly showMask = signal(false);
  readonly animationFrame = signal<HTMLCanvasElement | null>(null);
  readonly hasAnimationStarted = signal(false);
  readonly isPlaying = signal(false);
  readonly animationProgress = signal(0);
  readonly videoSettings = signal<VideoExportSettings>({
    ...DEFAULT_VIDEO_EXPORT_SETTINGS,
  });
  private animationRequestId = signal<number | null>(null);
  private animationStartTime = signal(0);

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Stop any existing animation.
    this.stopAnimation();

    // Upload and decode the image.
    await this.editorStore.uploadImage(file);

    // Only run detection when upload succeeded.
    if (this.editorStore.uploadedImage()) {
      await this.editorStore.detectPlayer();
    }

    // Allow selecting the same file again.
    input.value = '';
  }

  stopAnimation(): void {
    this.pauseAnimation();

    this.animationProgress.set(0);
    this.animationFrame.set(null);
    this.hasAnimationStarted.set(false);
  }

  playAnimation(): void {
    const uploaded = this.editorStore.uploadedImage();
    const mask = this.editorStore.playerMask();

    if (!uploaded || !mask || this.isPlaying()) {
      return;
    }

    this.hasAnimationStarted.set(true);

    // Restart if we're already at the end.
    if (this.animationProgress() >= 1) {
      this.animationProgress.set(0);
    }

    const durationMs = getEffectiveDurationSeconds(this.videoSettings()) * 1000;

    this.animationStartTime.set(performance.now() - this.animationProgress() * durationMs);

    this.isPlaying.set(true);

    const animate = (timestamp: number) => {
      if (!this.isPlaying()) {
        return;
      }

      const elapsed = timestamp - this.animationStartTime();

      const progress = Math.min(1, elapsed / durationMs);

      this.renderAnimationAt(progress);

      if (progress >= 1) {
        if (this.videoSettings().loop) {
          this.animationStartTime.set(timestamp);
          this.animationProgress.set(0);
          this.animationRequestId.set(requestAnimationFrame(animate));
        } else {
          this.isPlaying.set(false);
          this.animationRequestId.set(null);
        }

        return;
      }

      this.animationRequestId.set(requestAnimationFrame(animate));
    };

    this.animationRequestId.set(requestAnimationFrame(animate));
  }

  pauseAnimation(): void {
    this.isPlaying.set(false);

    if (this.animationRequestId() !== null) {
      cancelAnimationFrame(this.animationRequestId()!);
      this.animationRequestId.set(null);
    }
  }

  replayAnimation(): void {
    this.pauseAnimation();

    this.animationProgress.set(0);

    this.playAnimation();
  }

  seekAnimation(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));

    this.pauseAnimation();

    this.hasAnimationStarted.set(true);

    this.renderAnimationAt(clamped);
  }

  onUpdateVideoSettings($event: VideoExportSettings) {
    this.videoSettings.set($event);
  }

  private renderAnimationAt(progress: number): void {
    const uploaded = this.editorStore.uploadedImage();
    const mask = this.editorStore.playerMask();

    if (!uploaded || !mask) {
      return;
    }

    const frame = this.animationService.renderFrame(
      uploaded.image,
      mask,
      this.editorStore.motionSettings(),
      this.videoSettings(),
      progress,
    );

    this.animationFrame.set(frame);
    this.animationProgress.set(progress);
  }
}

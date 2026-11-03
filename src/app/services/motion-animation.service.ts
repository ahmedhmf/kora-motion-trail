import { Injectable, inject } from '@angular/core';

import { MotionTrailsService } from './motion-trails.service';

import { MotionSettings } from '../models/motion-settings.model';

import { VideoExportSettings } from '../models/video-export-settings.model';

@Injectable({
  providedIn: 'root',
})
export class MotionAnimationService {
  private readonly motionTrailsService = inject(MotionTrailsService);

  renderFrame(
    image: HTMLImageElement,
    mask: HTMLCanvasElement,
    motionSettings: MotionSettings,
    videoSettings: VideoExportSettings,
    progress: number,
  ): HTMLCanvasElement {
    const t = this.clamp(progress);

    const animatedIntensity = this.getAnimatedIntensity(t, videoSettings);
    const animationVisibility = 0.45 + animatedIntensity * 0.55;
    const frameSettings: MotionSettings = {
      ...motionSettings,

      // Keep the original trail distance.
      intensity: motionSettings.intensity,

      // Preserve the user's chosen strength.
      trailStrength: motionSettings.trailStrength,

      // Animate visibility without making
      // the echoes disappear completely.
      visibility: Math.round(
        motionSettings.visibility * animationVisibility * (videoSettings.intensity / 100),
      ),
    };

    return this.motionTrailsService.render(image, mask, frameSettings);
  }

  private getAnimatedIntensity(progress: number, settings: VideoExportSettings): number {
    switch (settings.animationStyle) {
      case 'reveal':
        // Starts with no trails and gradually
        // increases to full trail intensity.
        return this.easeOutCubic(progress);

      case 'pulse':
        // Smoothly fades the trails in and out.
        return 0.5 + 0.5 * Math.sin(progress * Math.PI * 4 - Math.PI / 2);

      case 'loop':
        // Start and end have the same intensity.
        return 0.5 - 0.5 * Math.cos(progress * Math.PI * 2);

      default:
        return 1;
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}

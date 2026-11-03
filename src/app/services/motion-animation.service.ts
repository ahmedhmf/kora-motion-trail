import { Injectable, inject } from '@angular/core';
import { MotionTrailsService } from './motion-trails.service';
import { MotionSettings } from '../models/motion-settings.model';
import { AnimationStyle, VideoExportSettings } from '../models/video-export-settings.model';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// Pure frame curves: shared by preview, seeking and video export.
export function getAnimationMotionSettings(
  motion: MotionSettings,
  video: VideoExportSettings,
  progress: number,
): MotionSettings {
  const t = clamp(progress);
  let visibilityLevel = 1;
  let distanceLevel = 1;
  let layersLevel = 1;

  switch (video.animationStyle) {
    case 'reveal':
      visibilityLevel = easeOutCubic(t);
      break;
    case 'pulse':
      visibilityLevel = 0.5 + 0.5 * Math.sin(t * Math.PI * 4 - Math.PI / 2);
      break;
    case 'loop':
      visibilityLevel = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      break;
    case 'reverse':
      // Fade the echoes away while leaving the original player untouched.
      visibilityLevel = 1 - easeOutCubic(t);
      break;
    case 'surge':
      // Motion extends outward over the animation, with a trailing echo buildup.
      distanceLevel = 0.35 + 0.65 * easeOutCubic(t);
      layersLevel = 0.5 + 0.5 * easeOutCubic(t);
      visibilityLevel = 0.35 + 0.65 * easeOutCubic(t);
      break;
    case 'heartbeat': {
      // Two softened beats per cycle; endpoints meet for looping.
      const beat = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 2 * t)), 8);
      visibilityLevel = 0.28 + 0.72 * beat;
      distanceLevel = 0.78 + 0.22 * beat;
      break;
    }
    case 'shimmer':
      // Fast, gentle rhythmic fluctuations, never completely blank.
      visibilityLevel = 0.68 + 0.32 * (0.5 + 0.5 * Math.cos(2 * Math.PI * 6 * t));
      break;
    case 'bounce': {
      // Echolocation-style breathing in/out in space rather than just opacity.
      const bounce = 0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * t);
      distanceLevel = 0.45 + 0.55 * bounce;
      visibilityLevel = 0.55 + 0.45 * bounce;
      break;
    }
    default:
      return { ...motion };
  }

  // Preserve the legacy visibility envelope and the user's original trail strength.
  const animationVisibility = 0.45 + visibilityLevel * 0.55;
  return {
    ...motion,
    intensity: Math.round(motion.intensity * distanceLevel),
    layers: Math.max(2, Math.round(motion.layers * layersLevel)),
    trailStrength: motion.trailStrength,
    visibility: Math.round(
      motion.visibility * animationVisibility * (video.intensity / 100),
    ),
  };
}

export const ANIMATION_STYLES: readonly {
  id: AnimationStyle;
  label: string;
  description: string;
}[] = [
  { id: 'reveal', label: 'Trail Reveal', description: 'Echoes gradually appear' },
  { id: 'pulse', label: 'Pulse', description: 'Trails rhythmically fade in and out' },
  { id: 'loop', label: 'Seamless Loop', description: 'One smooth brightness cycle' },
  { id: 'reverse', label: 'Reverse Reveal', description: 'Echoes disappear over time' },
  { id: 'surge', label: 'Speed Surge', description: 'Trails grow longer and denser' },
  { id: 'heartbeat', label: 'Heartbeat', description: 'Two strong beats per cycle' },
  { id: 'shimmer', label: 'Shimmer', description: 'Subtle rapid brightness ripples' },
  { id: 'bounce', label: 'Echo Bounce', description: 'Trails expand and contract' },
];

@Injectable({ providedIn: 'root' })
export class MotionAnimationService {
  private readonly motionTrailsService = inject(MotionTrailsService);

  renderFrame(
    image: HTMLImageElement,
    mask: HTMLCanvasElement,
    motionSettings: MotionSettings,
    videoSettings: VideoExportSettings,
    progress: number,
  ): HTMLCanvasElement {
    const frameSettings = getAnimationMotionSettings(
      motionSettings, videoSettings, progress,
    );
    return this.motionTrailsService.render(image, mask, frameSettings);
  }
}

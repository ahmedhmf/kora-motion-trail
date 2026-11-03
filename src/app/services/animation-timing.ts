import {
  AnimationEasing,
  VideoExportSettings,
} from '../models/video-export-settings.model';

export function getEffectiveDurationSeconds(
  settings: Pick<VideoExportSettings, 'durationSeconds' | 'speed'>,
): number {
  const speed = Number.isFinite(settings.speed) && settings.speed > 0 ? settings.speed : 1;
  const duration = Number.isFinite(settings.durationSeconds) && settings.durationSeconds > 0
    ? settings.durationSeconds : 5;
  return duration / speed;
}

// Transform normalized playback progress, not the total video duration.
// This applies uniformly to playback, timeline seeking and exported frames.
export function easeAnimationProgress(progress: number, easing: AnimationEasing): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  switch (easing) {
    case 'ease-in':
      return t * t * t;
    case 'ease-out':
      return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'linear':
    default:
      return t;
  }
}

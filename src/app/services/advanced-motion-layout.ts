import {
  MotionSettings,
  TrailFadeCurve,
  TrailSpacing,
} from '../models/motion-settings.model';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export interface EchoLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  // For drawing the padded glow with the same scale and centre.
  scale: number;
  fade: number;
  secondaryFade: number;
  pivotX: number;
  pivotY: number;
  rotationRadians: number;


export function getEchoLayout(
  index: number,
  layers: number,
  width: number,
  height: number,
  settings: MotionSettings,
  anchorX = width / 2,
  anchorY = height / 2,
): EchoLayout {
  const progress = clamp(index / Math.max(1, layers), 0, 1);
  const spacing: Record<TrailSpacing, number> = {
    tight: 1.6, normal: 1, wide: 0.65,
  };
  const spacedProgress = Math.pow(progress, spacing[settings.trailSpacing] ?? 1);
  const angle = (settings.directionAngle * Math.PI) / 180;
  const intensity = clamp(settings.intensity / 100, 0, 1);
  const distance = Math.min(width, height) * 0.45 *
    intensity * clamp(settings.trailDistance / 100, 0, 2) * spacedProgress;
  const scale = 1 + (clamp(settings.echoScale, 50, 150) / 100 - 1) * progress;
  const drawWidth = width * scale;
  const drawHeight = height * scale;

  // A quadratic-style sideways bend: zero at each end and strongest midway.
  // Both the path and the rotation are deterministic for animation/export.
  const curvature = clamp(settings.pathCurve, -100, 100) / 100;
  const perpendicularDistance = Math.min(width, height) * 0.45 *
    intensity * clamp(settings.trailDistance / 100, 0, 2) *
    0.65 * curvature * 4 * spacedProgress * (1 - spacedProgress);
  const travelX = Math.cos(angle) * distance + Math.sin(angle) * perpendicularDistance;
  const travelY = -Math.sin(angle) * distance + Math.cos(angle) * perpendicularDistance;
  const rotationRadians = clamp(settings.echoRotation, -45, 45) *
    progress * Math.PI / 180;

  return {
    x: anchorX * (1 - scale) + travelX,
    y: anchorY * (1 - scale) + travelY,
    width: drawWidth,
    height: drawHeight,
    scale,
    pivotX: anchorX + travelX,
    pivotY: anchorY + travelY,
    rotationRadians,
    fade: getTrailFade(progress, settings.trailFadeCurve),
    // Match the original secondary-pass fade when the preset is Classic.
    secondaryFade: settings.trailFadeCurve === 'classic'
      ? Math.pow(1 - progress, 0.65)
      : getTrailFade(progress, settings.trailFadeCurve),
  };
}

export function getTrailFade(progress: number, curve: TrailFadeCurve): number {
  const t = clamp(progress, 0, 1);
  switch (curve) {
    case 'linear':
      return 1 - 0.85 * t;
    case 'smooth':
      return Math.pow(1 - t, 0.6);
    case 'sharp':
      return Math.pow(1 - t, 2);
    case 'constant':
      return 1;
    case 'classic':
    default:
      return 1 - t * 0.35;
  }
}

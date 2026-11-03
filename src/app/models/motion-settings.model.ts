export type MotionDirection =
  | 'left'
  | 'right'
  | 'up'
  | 'down';

export type TrailColorMode = 'original' | 'solid';
export type TrailSpacing = 'tight' | 'normal' | 'wide';
export type TrailFadeCurve = 'classic' | 'linear' | 'smooth' | 'sharp' | 'constant';

// Angle convention: 0° right, 90° up, 180° left, 270° down.
export const DIRECTION_ANGLES: Record<MotionDirection, number> = {
  right: 0, up: 90, left: 180, down: 270,
};

export interface MotionSettings {
  intensity: number;
  preservation: number;
  layers: number;
  direction: MotionDirection;
  visibility: number;

  trailStrength: number; // 0–100
  trailColorMode: TrailColorMode;
  trailColor: string;
  glowEnabled: boolean;
  glowIntensity: number;
  glowBlur: number;
  trailDistance: number; // 0–200% of the legacy distance
  trailSpacing: TrailSpacing;
  directionAngle: number; // 0–360 degrees
  trailFadeCurve: TrailFadeCurve;
  echoScale: number; // distant echo scale: 50–150%
}

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  intensity: 65,
  preservation: 80,
  layers: 9,
  direction: 'left',

  visibility: 100,
  trailStrength: 85,
  trailColorMode: 'original',
  trailColor: '#00e5ff',
  glowEnabled: false,
  glowIntensity: 65,
  glowBlur: 18,
  trailDistance: 100,
  trailSpacing: 'normal',
  directionAngle: 180,
  trailFadeCurve: 'classic',
  echoScale: 100,
};

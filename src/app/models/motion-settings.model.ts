export type MotionDirection =
  | 'left'
  | 'right'
  | 'up'
  | 'down';

export type TrailColorMode = 'original' | 'solid';

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
};

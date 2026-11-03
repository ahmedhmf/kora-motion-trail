export type MotionDirection =
  | 'left'
  | 'right'
  | 'up'
  | 'down';

export interface MotionSettings {
  intensity: number;
  preservation: number;
  layers: number;
  direction: MotionDirection;
  visibility: number;

  trailStrength: number; // 0–100
}

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  intensity: 65,
  preservation: 80,
  layers: 9,
  direction: 'left',

  visibility: 100,
  trailStrength: 85,
};

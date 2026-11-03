export type MotionSubject = 'player' | 'ball';
export interface BallSelection {
  // Coordinates and radius in source-image pixels.
  x: number;
  y: number;
  radius: number;
}

export function getBallSelectionAt(
  x: number, y: number, radius: number, width: number, height: number,
): BallSelection {
  return {
    x: Math.min(width, Math.max(0, x)),
    y: Math.min(height, Math.max(0, y)),
    radius: Math.max(2, Math.min(Math.min(width, height) / 3, radius)),
  };
}

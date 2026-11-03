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
  const clamp = (value: number, min: number, max: number, fallback: number) =>
    Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  return {
    x: clamp(x, 0, width, width / 2),
    y: clamp(y, 0, height, height / 2),
    radius: clamp(radius, 2, Math.max(2, Math.min(width, height) / 3), 8),
  };
}

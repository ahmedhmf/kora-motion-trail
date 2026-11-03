import { describe, expect, it } from 'vitest';
import {
  CORRECTION_PROPAGATION_FRAMES, nearestCorrection, upsertCorrection,
  validCorrection, applyVideoCorrections, type VideoCorrectionKeyframe,
} from './video-correction-keyframes';

const key = (subject: 'ball' | 'player', frame: number, x: number): VideoCorrectionKeyframe =>
  ({ subject, frame, center: { x, y: 40 }, radius: 8 });

describe('video correction timeline keyframes', () => {
  it('keeps player and ball corrections separate at the same time', () => {
    const player = key('player', 5, 24);
    const ball = key('ball', 5, 60);
    const keys = upsertCorrection(upsertCorrection([], player), ball);
    expect(keys).toEqual([ball, player]);
    expect(nearestCorrection(keys, 'player', 5)?.keyframe).toEqual(player);
    expect(nearestCorrection(keys, 'ball', 5)?.keyframe).toEqual(ball);
  });

  it('replaces a correction at the same frame instead of accumulating offsets', () => {
    const old = key('ball', 8, 30);
    const newer = key('ball', 8, 75);
    expect(upsertCorrection([old, key('player', 8, 50)], newer)).toEqual([
      newer, key('player', 8, 50),
    ]);
  });

  it('limits propagation to two frames on either side', () => {
    const correction = key('ball', 10, 40);
    expect(nearestCorrection([correction], 'ball', 10)?.influence).toBe(1);
    expect(nearestCorrection([correction], 'ball', 9)?.influence).toBeCloseTo(2 / 3);
    expect(nearestCorrection([correction], 'ball', 8)?.influence).toBeCloseTo(1 / 3);
    expect(nearestCorrection([correction], 'ball', 7)).toBeNull();
    expect(nearestCorrection([correction], 'ball', 13)).toBeNull();
    expect(CORRECTION_PROPAGATION_FRAMES).toBe(2);
  });

  it('uses nearest correction, with deterministic precedence for ties', () => {
    const keys = [key('ball', 6, 20), key('ball', 10, 90)];
    expect(nearestCorrection(keys, 'ball', 7)?.keyframe.frame).toBe(6);
    expect(nearestCorrection(keys, 'ball', 9)?.keyframe.frame).toBe(10);
    expect(nearestCorrection(keys, 'ball', 8)?.keyframe.frame).toBe(6);
    expect(nearestCorrection(keys, 'player', 8)).toBeNull();
  });

  it('rejects invalid or out-of-range frame and position data', () => {
    expect(validCorrection(key('ball', 0, 50), 20, 100, 100)).toBe(true);
    expect(validCorrection(key('ball', 20, 50), 20, 100, 100)).toBe(false);
    expect(validCorrection(key('ball', -1, 50), 20, 100, 100)).toBe(false);
    expect(validCorrection(key('ball', 1, NaN), 20, 100, 100)).toBe(false);
    expect(validCorrection({ ...key('ball', 1, 50), radius: 80 }, 20, 100, 100)).toBe(false);
  });

  it('does not modify original video frames if no corrections exist', () => {
    const frame = { source: {} } as Parameters<typeof applyVideoCorrections>[0][number];
    const original = [frame];
    const result = applyVideoCorrections(original, []);
    expect(result).toEqual(original);
    expect(result).not.toBe(original);
    expect(result[0]).toBe(original[0]);
  });

  it('rejects invalid corrections before modifying any masks', () => {
    const source = { width: 100, height: 100 } as HTMLCanvasElement;
    const frame = { source } as Parameters<typeof applyVideoCorrections>[0][number];
    expect(() => applyVideoCorrections([frame], [key('ball', 4, 50)]))
      .toThrow('Invalid correction keyframe.');
  });
});

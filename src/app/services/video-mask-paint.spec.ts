import { describe, expect, it } from 'vitest';
import { applyBrightnessPaintDelta } from './video-mask-paint';
import {
  nearestCorrection, upsertCorrection, type VideoCorrectionKeyframe,
} from './video-correction-keyframes';

const array = (items: number[]) => new Uint8ClampedArray(items);

describe('video paint mask keyframe propagation', () => {
  it('propagates Add and Erase differences without replacing the other frame mask', () => {
    const initial = array([0, 255, 0, 0]);
    const painted = array([255, 0, 0, 0]);
    const neighbor = array([0, 255, 0, 200]);
    const result = applyBrightnessPaintDelta(
      initial, painted, neighbor, 4, 1, { x: 0, y: 0 }, 1,
    );
    expect(Array.from(result)).toEqual([255, 0, 0, 200]);
    expect(Array.from(neighbor)).toEqual([0, 255, 0, 200]);
  });

  it('attenuates edits at the edge of the two-frame window', () => {
    const result = applyBrightnessPaintDelta(
      array([0, 255]), array([255, 0]), array([0, 255]),
      2, 1, { x: 0, y: 0 }, 1 / 3,
    );
    expect(Array.from(result)).toEqual([85, 170]);
  });

  it('translates changed pixels with the tracked subject position', () => {
    const result = applyBrightnessPaintDelta(
      array([0, 0, 0, 0]), array([255, 0, 0, 0]),
      array([0, 0, 0, 0]), 4, 1, { x: 2, y: 0 }, 1,
    );
    expect(Array.from(result)).toEqual([0, 0, 255, 0]);
  });

  it('clips translated edits at the canvas bounds', () => {
    const result = applyBrightnessPaintDelta(
      array([0, 0, 0]), array([0, 0, 255]), array([0, 40, 0]),
      3, 1, { x: 3, y: 0 }, 1,
    );
    expect(Array.from(result)).toEqual([0, 40, 0]);
  });

  it('does not mutate input arrays or accumulate edits on repeated calls', () => {
    const source = array([0, 0, 0]);
    const painted = array([255, 0, 0]);
    const target = array([0, 0, 0]);
    const first = applyBrightnessPaintDelta(source, painted, target,
      3, 1, { x: 0, y: 0 }, 1);
    const second = applyBrightnessPaintDelta(source, painted, target,
      3, 1, { x: 0, y: 0 }, 1);
    expect(first).toEqual(second);
    expect(Array.from(target)).toEqual([0, 0, 0]);
  });

  it('rejects mask dimension mismatches', () => {
    expect(() => applyBrightnessPaintDelta(array([0]), array([0, 0]),
      array([0]), 1, 1, { x: 0, y: 0 }, 1)).toThrow();
  });

  it('preserves separate Player and Ball painted keyframes per frame', () => {
    const player: VideoCorrectionKeyframe = {
      subject: 'player', frame: 4, center: { x: 10, y: 10 }, radius: 8,
      paintedMask: {} as HTMLCanvasElement,
    };
    const ball: VideoCorrectionKeyframe = {
      subject: 'ball', frame: 4, center: { x: 50, y: 10 }, radius: 8,
      paintedMask: {} as HTMLCanvasElement,
    };
    const keys = upsertCorrection(upsertCorrection([], player), ball);
    expect(keys).toHaveLength(2);
    expect(nearestCorrection(keys, 'player', 4)?.keyframe).toBe(player);
    expect(nearestCorrection(keys, 'ball', 4)?.keyframe).toBe(ball);
    expect(nearestCorrection(keys, 'ball', 7)).toBeNull();
  });
});

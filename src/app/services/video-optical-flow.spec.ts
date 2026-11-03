import { describe, expect, it } from 'vitest';
import {
  advectMaskDelta, computeFlowField, flowAt, matchPatch,
  type FlowField, type GrayFrame,
} from './video-optical-flow';

function image(width = 48, height = 48, dx = 0, dy = 0): GrayFrame {
  const pixels = new Uint8Array(width * height);
  for (let y = 8; y < height - 8; y++) {
    for (let x = 8; x < width - 8; x++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
        pixels[yy * width + xx] = (x * 71 + y * 43 + x * y * 17) % 256;
      }
    }
  }
  return { width, height, pixels };
}

function uniformFlow(width: number, height: number, dx: number, dy: number): FlowField {
  const columns = Math.ceil(width / 8), rows = Math.ceil(height / 8);
  return {
    width, height, columns, rows, step: 8,
    dx: new Float32Array(columns * rows).fill(dx),
    dy: new Float32Array(columns * rows).fill(dy),
    valid: new Uint8Array(columns * rows).fill(1),
  };
}

describe('short-range optical flow', () => {
  it('finds correct horizontal and vertical motion from textured video patches', () => {
    const match = matchPatch(image(), image(48, 48, 3, -2), 24, 24, 6);
    expect(match).not.toBeNull();
    expect(match!.dx).toBe(3);
    expect(match!.dy).toBe(-2);
    expect(match!.error).toBe(0);
  });

  it('rejects featureless background rather than inventing a displacement', () => {
    const blank = { width: 24, height: 24, pixels: new Uint8Array(24 * 24).fill(30) };
    expect(matchPatch(blank, blank, 12, 12)).toBeNull();
  });

  it('builds sampled flow and returns a nearby valid patch', () => {
    const flow = computeFlowField(image(), image(48, 48, 2, 1), 8);
    expect(flowAt(flow, 24, 24)).toEqual({ x: 2, y: 1 });
  });

  it('moves Add and Erase deltas using pixel-local flow instead of center translation', () => {
    const initial = new Uint8ClampedArray([0, 255, 0, 0, 0, 0]);
    const painted = new Uint8ClampedArray([255, 0, 0, 0, 0, 0]);
    const target = new Uint8ClampedArray([0, 0, 0, 255, 255, 0]);
    const output = advectMaskDelta(initial, painted, target, 6, 1,
      [uniformFlow(6, 1, 2, 0)], { x: 0, y: 0 }, 1, false);
    expect(Array.from(output)).toEqual([0, 0, 255, 0, 0, 0]);
    expect(Array.from(target)).toEqual([0, 0, 0, 255, 255, 0]);
  });

  it('composes motion through multiple adjacent frames', () => {
    const initial = new Uint8ClampedArray(12);
    const painted = new Uint8ClampedArray(12);
    painted[2] = 255;
    const output = advectMaskDelta(initial, painted, initial, 12, 1,
      [uniformFlow(12, 1, 2, 0), uniformFlow(12, 1, 3, 0)],
      { x: 0, y: 0 }, 1, true);
    expect(output[7]).toBe(255);
    expect(output[2]).toBe(0);
  });

  it('falls back to tracked displacement where the patch is unreliable', () => {
    const from = new Uint8ClampedArray(8);
    const painted = new Uint8ClampedArray(8);
    painted[1] = 255;
    const flow = uniformFlow(8, 1, 5, 0);
    flow.valid.fill(0);
    const result = advectMaskDelta(from, painted, from, 8, 1,
      [flow], { x: 3, y: 0 }, 1, true);
    expect(result[4]).toBe(255);
  });

  it('preserves originals and rejects dimension mismatches', () => {
    const initial = new Uint8ClampedArray(6);
    const painted = new Uint8ClampedArray(6);
    painted[2] = 255;
    const target = new Uint8ClampedArray(6);
    advectMaskDelta(initial, painted, target, 6, 1,
      [], { x: 0, y: 0 }, 1, false);
    expect(Array.from(target)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(() => advectMaskDelta(initial, painted, target, 5, 1,
      [], { x: 0, y: 0 }, 1, false)).toThrow();
    expect(() => computeFlowField(image(), image(12, 12))).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { buildClassifiedMaskData, hasMaskForeground } from './segmentation-mask-data';

function overlay(alphas: number[]): Uint8Array {
  const values = new Uint8Array(alphas.length * 4);
  alphas.forEach((alpha, i) => {
    values[i * 4] = 30;
    values[i * 4 + 3] = alpha;
  });
  return values;
}

function grayscalePixels(mask: Uint8ClampedArray): number[] {
  const result: number[] = [];
  for (let i = 0; i < mask.length; i += 4) {
    result.push(mask[i]);
    expect(mask[i]).toBe(mask[i + 1]);
    expect(mask[i]).toBe(mask[i + 2]);
    expect(mask[i + 3]).toBe(255);
  }
  return result;
}

describe('three-class subject masks', () => {
  it('creates player, ball and union masks independently', () => {
    const result = buildClassifiedMaskData(
      overlay([255, 0, 0, 255]),
      overlay([0, 255, 0, 0]),
      2, 2,
    );
    expect(grayscalePixels(result.player)).toEqual([255, 0, 0, 255]);
    expect(grayscalePixels(result.ball)).toEqual([0, 255, 0, 0]);
    expect(grayscalePixels(result.combined)).toEqual([255, 255, 0, 255]);
    expect(hasMaskForeground(result.ball)).toBe(true);
  });

  it('keeps masks disjoint when both detectors cover the same pixel', () => {
    const result = buildClassifiedMaskData(
      overlay([255, 255]), overlay([0, 255]), 2, 1,
    );
    expect(grayscalePixels(result.player)).toEqual([255, 0]);
    expect(grayscalePixels(result.ball)).toEqual([0, 255]);
    expect(grayscalePixels(result.combined)).toEqual([255, 255]);
  });

  it('returns an empty ball mask when the ball was not detected', () => {
    const result = buildClassifiedMaskData(
      overlay([255, 0]), overlay([0, 0]), 2, 1,
    );
    expect(hasMaskForeground(result.player)).toBe(true);
    expect(hasMaskForeground(result.ball)).toBe(false);
    expect(grayscalePixels(result.combined)).toEqual([255, 0]);
  });

  it('rejects dimensions that do not match either class overlay', () => {
    expect(() => buildClassifiedMaskData(overlay([255]), overlay([0]), 2, 1))
      .toThrow('invalid class segmentation dimensions');
  });
});

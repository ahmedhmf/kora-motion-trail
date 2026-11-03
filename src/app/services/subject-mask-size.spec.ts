import { afterEach, describe, expect, it, vi } from 'vitest';
import { excludeBallFromPlayer, scaleDetectedBallMask } from './subject-masks';

describe('detected ball mask size', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scales around the detected foreground instead of the image centre', () => {
    const width = 10, height = 8;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]]) {
      pixels[(y * width + x) * 4] = 255;
    }
    const translate = vi.fn(), scale = vi.fn(), drawImage = vi.fn();
    const ctx = {
      fillRect: vi.fn(),
      translate,
      scale,
      drawImage,
      getImageData: vi.fn(() => ({ data: pixels })),
      fillStyle: '',
      imageSmoothingEnabled: true,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const source = document.createElement('canvas');
    source.width = width; source.height = height;
    const grown = scaleDetectedBallMask(source, 200);
    expect(grown.width).toBe(width);
    expect(grown.height).toBe(height);
    expect(translate).toHaveBeenNthCalledWith(1, 3, 4);
    expect(scale).toHaveBeenCalledWith(2, 2);
    expect(translate).toHaveBeenNthCalledWith(2, -3, -4);
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0);
  });

  it('rejects invalid sizing values', () => {
    const source = document.createElement('canvas');
    for (const value of [0, 300, NaN, Infinity]) {
      expect(() => scaleDetectedBallMask(source, value)).toThrow();
    }
  });

  it('subtracts enlarged ball luminance without altering original player data', () => {
    const player = document.createElement('canvas');
    const ball = document.createElement('canvas');
    player.width = ball.width = 2;
    player.height = ball.height = 1;
    const original = new Uint8ClampedArray([255, 255, 255, 255, 200, 200, 200, 255]);
    const overlap = new Uint8ClampedArray([100, 100, 100, 255, 250, 250, 250, 255]);
    const putImageData = vi.fn();
    const ctx = {
      getImageData: vi.fn()
        .mockReturnValueOnce({ data: new Uint8ClampedArray(original) })
        .mockReturnValueOnce({ data: overlap }),
      putImageData,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    excludeBallFromPlayer(player, ball);
    expect(Array.from(putImageData.mock.calls[0][0].data))
      .toEqual([155, 155, 155, 255, 0, 0, 0, 255]);
    expect(Array.from(original)).toEqual([255, 255, 255, 255, 200, 200, 200, 255]);
  });
});

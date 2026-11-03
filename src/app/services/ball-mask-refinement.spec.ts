import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneBallMask, paintBallMaskStroke, rebuildMasksFromBall } from './subject-masks';

describe('ball mask refinement', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalizes a transparent manual ball mask into opaque grayscale', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 255, 255, 0,
      200, 200, 200, 128,
    ]);
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getImageData: () => ({ data }),
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    const source = document.createElement('canvas');
    source.width = 3;
    source.height = 1;
    const copy = cloneBallMask(source);
    expect(copy).not.toBe(source);
    expect(copy.width).toBe(3);
    expect(Array.from(putImageData.mock.calls[0][0].data)).toEqual([
      255, 255, 255, 255,
      0, 0, 0, 255,
      100, 100, 100, 255,
    ]);
  });

  it.each(['add', 'erase'] as const)(
    'draws continuous %s strokes with the right mask brightness',
    (mode) => {
      const ctx = {
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        arc: vi.fn(), fill: vi.fn(),
        lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
      };
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
      paintBallMaskStroke(document.createElement('canvas'),
        { x: 10, y: 15 }, { x: 45, y: 50 }, 20, mode);
      expect(ctx.moveTo).toHaveBeenCalledWith(10, 15);
      expect(ctx.lineTo).toHaveBeenCalledWith(45, 50);
      expect(ctx.lineWidth).toBe(20);
      expect(ctx.lineCap).toBe('round');
      expect(ctx.strokeStyle).toBe(mode === 'add' ? '#ffffff' : '#000000');
      expect(ctx.arc).toHaveBeenCalledWith(45, 50, 10, 0, 2 * Math.PI);
    },
  );

  it('rejects masks with mismatched dimensions before committing edits', () => {
    const player = document.createElement('canvas');
    const ball = document.createElement('canvas');
    player.width = 100; ball.width = 50;
    expect(() => rebuildMasksFromBall(player, ball)).toThrow(/matching dimensions/);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBallSelectionAt } from '../models/subject-selection.model';
import { splitSubjectMasks } from './subject-masks';

describe('player and ball separation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('clamps a manually picked ball to image coordinates and a valid radius', () => {
    expect(getBallSelectionAt(-12, 900, 200, 300, 150)).toEqual({
      x: 0, y: 150, radius: 50,
    });
    expect(getBallSelectionAt(NaN, NaN, NaN, 300, 150)).toEqual({
      x: 150, y: 75, radius: 8,
    });
  });

  it('creates separate source-sized masks and subtracts the ball from the player', () => {
    const operations: string[] = [];
    const ctx = {
      fillStyle: '',
      globalCompositeOperation: 'source-over',
      beginPath: vi.fn(),
      arc: vi.fn((x: number, y: number, radius: number) => {
        operations.push(`circle:${x},${y},${radius}`);
      }),
      fill: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

    const combined = document.createElement('canvas');
    combined.width = 300;
    combined.height = 150;
    const { player, ball } = splitSubjectMasks(combined, { x: 125, y: 70, radius: 12 });

    expect(player.width).toBe(300);
    expect(player.height).toBe(150);
    expect(ball.width).toBe(300);
    expect(ball.height).toBe(150);
    expect(ctx.drawImage).toHaveBeenCalledWith(combined, 0, 0);
    expect(operations).toEqual(['circle:125,70,12', 'circle:125,70,12']);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });
});

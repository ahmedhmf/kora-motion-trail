import { describe, expect, it } from 'vitest';
import {
  findMaskComponents, SubjectTracker, trackMasks, MAX_TRACK_GAP,
  type TrackBox,
} from './subject-tracking';

function box(x: number, y: number, width = 12, height = 12): TrackBox {
  return { x, y, width, height, area: width * height };
}

function paintMask(width: number, height: number, bounds: readonly TrackBox[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const b of bounds) {
    for (let y = b.y; y < b.y + b.height; y++) {
      for (let x = b.x; x < b.x + b.width; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        data[(y * width + x) * 4] = 255;
        data[(y * width + x) * 4 + 3] = 255;
      }
    }
  }
  return data;
}

describe('mask component observations', () => {
  it('extracts separate player and ball shaped regions', () => {
    const regions = findMaskComponents(paintMask(80, 60, [
      box(3, 5, 10, 20), box(60, 40, 4, 4),
    ]), 80, 60);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toEqual(box(3, 5, 10, 20));
    expect(regions[1]).toEqual(box(60, 40, 4, 4));
  });

  it('ignores tiny specks and respects touching regions', () => {
    const regions = findMaskComponents(paintMask(25, 25, [
      box(3, 3, 5, 5), box(8, 3, 4, 5), box(20, 20, 1, 1),
    ]), 25, 25, 2);
    expect(regions).toHaveLength(1);
    expect(regions[0].width).toBe(9);
  });

  it('rejects dimensions inconsistent with mask data', () => {
    expect(() => findMaskComponents(new Uint8ClampedArray(12), 4, 4)).toThrow();
  });
});

describe('cross-frame subject tracking', () => {
  it('follows the nearest player rather than switching to a larger distractor', () => {
    const tracker = new SubjectTracker(320, 180, 'player');
    const initial = tracker.update([box(35, 30, 20, 40)]);
    const next = tracker.update([
      box(40, 33, 20, 40),
      box(200, 30, 40, 70),
    ]);
    expect(initial.status).toBe('detected');
    expect(next.status).toBe('detected');
    expect(next.detectedCenter?.x).toBe(50);
  });

  it('smooths jitter while preserving the measured location separately', () => {
    const tracker = new SubjectTracker(320, 180, 'player');
    tracker.update([box(40, 35)]);
    const next = tracker.update([box(60, 35)]);
    expect(next.detectedCenter?.x).toBe(66);
    expect(next.center!.x).toBeGreaterThan(46);
    expect(next.center!.x).toBeLessThan(66);
    expect(next.detectedCenter?.y).toBe(next.center?.y);
  });

  it('predicts short missing spans but never fabricates observed boxes', () => {
    const tracker = new SubjectTracker(320, 180, 'ball');
    tracker.update([box(20, 20, 5, 5)]);
    tracker.update([box(28, 20, 5, 5)]);
    for (let missed = 1; missed <= MAX_TRACK_GAP; missed++) {
      const prediction = tracker.update([]);
      expect(prediction.status).toBe('predicted');
      expect(prediction.center).not.toBeNull();
      expect(prediction.box).toBeNull();
      expect(prediction.detectedCenter).toBeNull();
      expect(prediction.missedFrames).toBe(missed);
    }
    const lost = tracker.update([]);
    expect(lost.status).toBe('missing');
    expect(lost.center).toBeNull();
    expect(lost.box).toBeNull();
  });

  it('rejects sudden implausible teleports and reacquires after a long gap', () => {
    const tracker = new SubjectTracker(320, 180, 'ball');
    tracker.update([box(20, 20, 5, 5)]);
    expect(tracker.update([box(280, 130, 5, 5)]).status).toBe('predicted');
    tracker.update([]);
    expect(tracker.update([]).status).toBe('missing');
    const reacquired = tracker.update([box(280, 130, 5, 5)]);
    expect(reacquired.status).toBe('detected');
    expect(reacquired.detectedCenter?.x).toBeCloseTo(282.5);
  });

  it('tracks ball and player independently even when one is absent', () => {
    const player = new SubjectTracker(320, 180, 'player');
    const ball = new SubjectTracker(320, 180, 'ball');
    player.update([box(40, 50, 30, 50)]);
    ball.update([box(120, 80, 5, 5)]);
    const p = player.update([box(45, 50, 30, 50)]);
    const b = ball.update([]);
    expect(p.status).toBe('detected');
    expect(b.status).toBe('predicted');
    expect(p.center!.x).toBeLessThan(b.center!.x);
  });

  it('returns missing when the subject never appeared', () => {
    const tracker = new SubjectTracker(320, 180, 'ball');
    const missing = tracker.update([]);
    expect(missing.status).toBe('missing');
    expect(missing.center).toBeNull();
  });

  it('handles clips with no sampled frames', () => {
    expect(trackMasks([])).toEqual([]);
  });
});

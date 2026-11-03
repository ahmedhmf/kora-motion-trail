import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION_SETTINGS } from '../models/motion-settings.model';
import { getEchoLayout, getTrailFade } from './advanced-motion-layout';

const base = { ...DEFAULT_MOTION_SETTINGS };
const echo = (changes: Partial<typeof base> = {}, index = 5) =>
  getEchoLayout(index, 10, 1000, 600, { ...base, intensity: 100, ...changes });

describe('advanced motion layout', () => {
  it('preserves legacy leftward distance, scale and opacity by default', () => {
    const result = echo({}, 10);
    expect(result.x).toBeCloseTo(-270);
    expect(result.y).toBeCloseTo(0);
    expect(result.width).toBe(1000);
    expect(result.height).toBe(600);
    expect(result.fade).toBeCloseTo(0.65);
    expect(result.secondaryFade).toBeCloseTo(0);
  });

  it('scales trail distance independently from intensity', () => {
    const normal = echo({ trailDistance: 100 }, 10);
    const twice = echo({ trailDistance: 200 }, 10);
    const none = echo({ trailDistance: 0 }, 10);
    expect(twice.x).toBeCloseTo(normal.x * 2);
    expect(none.x).toBeCloseTo(0);
  });

  it('changes spacing but keeps the farthest echo anchored', () => {
    const tight = echo({ trailSpacing: 'tight' });
    const normal = echo({ trailSpacing: 'normal' });
    const wide = echo({ trailSpacing: 'wide' });
    expect(tight.x).toBeGreaterThan(normal.x);
    expect(wide.x).toBeLessThan(normal.x);
    expect(echo({ trailSpacing: 'tight' }, 10).x)
      .toBeCloseTo(echo({ trailSpacing: 'wide' }, 10).x);
  });

  it('supports diagonal angles and all four cardinal directions', () => {
    const diagonal = echo({ directionAngle: 45 }, 10);
    expect(diagonal.x).toBeGreaterThan(0);
    expect(diagonal.y).toBeLessThan(0);
    expect(echo({ directionAngle: 0 }, 10).x).toBeCloseTo(270);
    expect(echo({ directionAngle: 90 }, 10).y).toBeCloseTo(-270);
    expect(echo({ directionAngle: 270 }, 10).y).toBeCloseTo(270);
  });

  it('scales distant silhouettes around the artwork centre', () => {
    const small = echo({ echoScale: 50 }, 10);
    const large = echo({ echoScale: 150 }, 10);
    expect(small.width).toBe(500);
    expect(small.height).toBe(300);
    expect(large.width).toBe(1500);
    expect(large.height).toBe(900);
  });

  it('keeps resized silhouettes anchored around an off-centre detected player', () => {
    const result = getEchoLayout(
      10, 10, 1000, 600,
      { ...base, intensity: 0, echoScale: 150 }, 200, 400,
    );
    expect(result.x).toBeCloseTo(-100);
    expect(result.y).toBeCloseTo(-200);
    expect(result.width).toBe(1500);
  });

  it('defaults to an unbent path and zero rotation', () => {
    for (const index of [1, 5, 10]) {
      const result = echo({}, index);
      expect(result.y).toBeCloseTo(0);
      expect(result.rotationRadians).toBe(0);
      expect(result.pivotX - 500).toBeCloseTo(result.x);
    }
  });

  it('curves intermediate echoes in opposite directions without changing the endpoint', () => {
    const straight = echo({ pathCurve: 0 }, 5);
    const left = echo({ pathCurve: 100 }, 5);
    const right = echo({ pathCurve: -100 }, 5);
    expect(left.y).toBeLessThan(straight.y);
    expect(right.y).toBeGreaterThan(straight.y);
    expect(left.x).toBeCloseTo(straight.x);
    expect(right.x).toBeCloseTo(straight.x);
    expect(echo({ pathCurve: 100 }, 10).y).toBeCloseTo(0);
    expect(echo({ pathCurve: -100 }, 10).y).toBeCloseTo(0);
  });

  it('rotates echoes progressively and respects an off-centre subject anchor', () => {
    const settings = {
      ...base, intensity: 0, echoScale: 150, echoRotation: 40, pathCurve: 0,
    };
    const near = getEchoLayout(5, 10, 1000, 600, settings, 200, 400);
    const far = getEchoLayout(10, 10, 1000, 600, settings, 200, 400);
    expect(near.rotationRadians).toBeCloseTo(20 * Math.PI / 180);
    expect(far.rotationRadians).toBeCloseTo(40 * Math.PI / 180);
    expect(far.pivotX).toBe(200);
    expect(far.pivotY).toBe(400);
    expect(far.x).toBeCloseTo(-100);
    expect(far.y).toBeCloseTo(-200);
  });

  it('keeps fading and spacing independent from curvature and rotation', () => {
    const original = echo({}, 5);
    const changed = echo({ pathCurve: 80, echoRotation: -30 }, 5);
    expect(changed.fade).toBe(original.fade);
    expect(changed.secondaryFade).toBe(original.secondaryFade);
    expect(changed.scale).toBe(original.scale);
  });

  it('provides distinct fade curves', () => {
    expect(getTrailFade(0.5, 'classic')).toBeCloseTo(0.825);
    expect(getTrailFade(0.5, 'linear')).toBeCloseTo(0.575);
    expect(getTrailFade(0.5, 'smooth')).toBeGreaterThan(getTrailFade(0.5, 'sharp'));
    expect(getTrailFade(0.9, 'constant')).toBe(1);
  });
});

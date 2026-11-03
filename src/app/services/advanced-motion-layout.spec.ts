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

  it('provides distinct fade curves', () => {
    expect(getTrailFade(0.5, 'classic')).toBeCloseTo(0.825);
    expect(getTrailFade(0.5, 'linear')).toBeCloseTo(0.575);
    expect(getTrailFade(0.5, 'smooth')).toBeGreaterThan(getTrailFade(0.5, 'sharp'));
    expect(getTrailFade(0.9, 'constant')).toBe(1);
  });
});

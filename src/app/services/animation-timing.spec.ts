import { describe, expect, it } from 'vitest';
import { DEFAULT_VIDEO_EXPORT_SETTINGS } from '../models/video-export-settings.model';
import { easeAnimationProgress, getEffectiveDurationSeconds } from './animation-timing';

describe('animation playback timing', () => {
  it('retains current duration at default speed', () => {
    expect(getEffectiveDurationSeconds(DEFAULT_VIDEO_EXPORT_SETTINGS)).toBe(5);
  });

  it('scales duration consistently for preview and export', () => {
    expect(getEffectiveDurationSeconds({ durationSeconds: 5, speed: 2 })).toBe(2.5);
    expect(getEffectiveDurationSeconds({ durationSeconds: 5, speed: 0.5 })).toBe(10);
    expect(getEffectiveDurationSeconds({ durationSeconds: 3, speed: 0.75 })).toBe(4);
  });

  it('preserves animation endpoints for all easings', () => {
    for (const easing of ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const) {
      expect(easeAnimationProgress(0, easing)).toBe(0);
      expect(easeAnimationProgress(1, easing)).toBe(1);
      expect(easeAnimationProgress(-3, easing)).toBe(0);
      expect(easeAnimationProgress(5, easing)).toBe(1);
    }
  });

  it('supports slow starts, slow finishes, and smooth transitions', () => {
    expect(easeAnimationProgress(0.25, 'linear')).toBe(0.25);
    expect(easeAnimationProgress(0.25, 'ease-in')).toBeLessThan(0.25);
    expect(easeAnimationProgress(0.25, 'ease-out')).toBeGreaterThan(0.25);
    expect(easeAnimationProgress(0.25, 'ease-in-out')).toBeLessThan(0.25);
    expect(easeAnimationProgress(0.75, 'ease-in-out')).toBeGreaterThan(0.75);
    expect(easeAnimationProgress(0.5, 'ease-in-out')).toBe(0.5);
  });

  it('handles invalid time parameters safely', () => {
    expect(getEffectiveDurationSeconds({ durationSeconds: 0, speed: 0.5 })).toBe(10);
    expect(easeAnimationProgress(Number.NaN, 'linear')).toBe(0);
  });
});

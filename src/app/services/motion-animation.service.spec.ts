import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION_SETTINGS } from '../models/motion-settings.model';
import { DEFAULT_VIDEO_EXPORT_SETTINGS } from '../models/video-export-settings.model';
import { ANIMATION_STYLES, getAnimationMotionSettings } from './motion-animation.service';

const motion = { ...DEFAULT_MOTION_SETTINGS };
const video = { ...DEFAULT_VIDEO_EXPORT_SETTINGS };
const frame = (style: typeof video.animationStyle | (typeof ANIMATION_STYLES)[number]['id'], t: number) =>
  getAnimationMotionSettings(motion, { ...video, animationStyle: style }, t);

describe('animation styles', () => {
  it('supports eight unique styles', () => {
    expect(ANIMATION_STYLES.map((style) => style.id)).toEqual([
      'reveal', 'pulse', 'loop', 'reverse',
      'surge', 'heartbeat', 'shimmer', 'bounce',
    ]);
  });

  it('retains the original trail strength and source settings', () => {
    for (const style of ANIMATION_STYLES) {
      const settings = frame(style.id, 0.42);
      expect(settings.trailStrength).toBe(motion.trailStrength);
      expect(settings.trailColor).toBe(motion.trailColor);
      expect(settings.direction).toBe(motion.direction);
      expect(settings.glowEnabled).toBe(motion.glowEnabled);
      expect(settings.visibility).toBeGreaterThanOrEqual(0);
      expect(settings.visibility).toBeLessThanOrEqual(100);
    }
    expect(motion).toEqual(DEFAULT_MOTION_SETTINGS);
  });

  it('keeps the existing reveal and reverse visibility curves', () => {
    expect(frame('reveal', 0).visibility).toBeLessThan(frame('reveal', 1).visibility);
    expect(frame('reverse', 0).visibility).toBeGreaterThan(frame('reverse', 1).visibility);
    expect(frame('pulse', 0).visibility).toBe(frame('pulse', 1).visibility);
    expect(frame('loop', 0).visibility).toBe(frame('loop', 1).visibility);
  });

  it('makes speed surge extend trails and add layers', () => {
    expect(frame('surge', 0).intensity).toBeLessThan(frame('surge', 1).intensity);
    expect(frame('surge', 0).layers).toBeLessThan(frame('surge', 1).layers);
  });

  it('makes echo bounce vary trail distance during playback', () => {
    expect(frame('bounce', 0.25).intensity).toBeGreaterThan(frame('bounce', 0).intensity);
  });

  it('keeps cyclical style endpoints visually consistent', () => {
    for (const style of ['heartbeat', 'shimmer', 'bounce'] as const) {
      expect(frame(style, 0)).toEqual(frame(style, 1));
    }
  });

  it('applies easing to the actual motion while preserving the same endpoints', () => {
    const base = { ...video, animationStyle: 'surge' as const };
    const linear = getAnimationMotionSettings(motion, { ...base, easing: 'linear' }, 0.25);
    const slowStart = getAnimationMotionSettings(motion, { ...base, easing: 'ease-in' }, 0.25);
    const fastStart = getAnimationMotionSettings(motion, { ...base, easing: 'ease-out' }, 0.25);
    expect(slowStart.intensity).toBeLessThan(linear.intensity);
    expect(fastStart.intensity).toBeGreaterThan(linear.intensity);
    expect(getAnimationMotionSettings(motion, { ...base, easing: 'ease-in' }, 0))
      .toEqual(getAnimationMotionSettings(motion, { ...base, easing: 'ease-out' }, 0));
    expect(getAnimationMotionSettings(motion, { ...base, easing: 'ease-in' }, 1))
      .toEqual(getAnimationMotionSettings(motion, { ...base, easing: 'ease-out' }, 1));
  });

  it('clamps out-of-range progress', () => {
    expect(frame('surge', -1)).toEqual(frame('surge', 0));
    expect(frame('surge', 2)).toEqual(frame('surge', 1));
  });
});

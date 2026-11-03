import { describe, expect, it } from 'vitest';
import {
  CLIP_FPS, CLIP_MAX_EDGE, CLIP_MAX_SECONDS,
  getClipDimensions, getClipSampleTimes,
} from './video-clip-frames.service';

describe('bounded video-frame processing', () => {
  it('samples video frames in increasing order at fixed frame rate', () => {
    const times = getClipSampleTimes(2);
    expect(times).toHaveLength(2 * CLIP_FPS);
    expect(times[0]).toBe(0);
    expect(times[1]).toBeCloseTo(1 / CLIP_FPS);
    expect(times.at(-1)).toBeLessThan(2);
  });

  it('limits videos to first 5 seconds even when source is longer', () => {
    expect(getClipSampleTimes(60)).toHaveLength(CLIP_MAX_SECONDS * CLIP_FPS);
    expect(getClipSampleTimes(60).at(-1)).toBeLessThan(CLIP_MAX_SECONDS);
  });

  it('limits the last frame to the actual clip duration', () => {
    expect(getClipSampleTimes(0.1)[0]).toBe(0);
    const times = getClipSampleTimes(1.01);
    expect(times.at(-1)).toBeLessThan(1.01);
  });

  it('enforces the maximum video edge while maintaining aspect ratio', () => {
    expect(getClipDimensions(1920, 1080)).toEqual({
      width: CLIP_MAX_EDGE,
      height: 270,
    });
    expect(getClipDimensions(1080, 1920)).toEqual({
      width: 270, height: CLIP_MAX_EDGE,
    });
    expect(getClipDimensions(320, 240)).toEqual({ width: 320, height: 240 });
  });

  it('rejects invalid video dimensions and durations', () => {
    expect(() => getClipSampleTimes(NaN)).toThrow();
    expect(() => getClipSampleTimes(0)).toThrow();
    expect(() => getClipDimensions(0, 400)).toThrow();
    expect(() => getClipDimensions(Infinity, 400)).toThrow();
  });
});

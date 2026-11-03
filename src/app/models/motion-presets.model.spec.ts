import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION_SETTINGS } from './motion-settings.model';
import { MOTION_PRESETS, findMatchingMotionPreset } from './motion-presets.model';

describe('motion presets', () => {
  it('provides distinct one-click styles', () => {
    expect(MOTION_PRESETS.map((preset) => preset.id)).toEqual([
      'classic', 'cinematic-echo', 'speed-burst', 'ghost-motion', 'neon-runner',
    ]);
  });

  it('defines every motion setting for each style', () => {
    const fields = Object.keys(DEFAULT_MOTION_SETTINGS).sort();
    for (const preset of MOTION_PRESETS) {
      expect(Object.keys(preset.settings).sort()).toEqual(fields);
      expect(findMatchingMotionPreset({ ...preset.settings })).toBe(preset.id);
    }
  });

  it('identifies manual changes as custom', () => {
    const neon = MOTION_PRESETS.find((preset) => preset.id === 'neon-runner')!;
    expect(findMatchingMotionPreset({ ...neon.settings, glowIntensity: 30 })).toBeNull();
  });

  it('does not mutate the default settings', () => {
    const classic = MOTION_PRESETS[0];
    expect(classic.settings).toEqual(DEFAULT_MOTION_SETTINGS);
    expect(MOTION_PRESETS[4].settings.trailColorMode).toBe('solid');
    expect(DEFAULT_MOTION_SETTINGS.trailColorMode).toBe('original');
    expect(DEFAULT_MOTION_SETTINGS.glowEnabled).toBe(false);
  });

  it('keeps silhouettes sufficiently strong across styles', () => {
    for (const preset of MOTION_PRESETS) {
      expect(preset.settings.trailStrength).toBeGreaterThanOrEqual(60);
      expect(preset.settings.layers).toBeGreaterThanOrEqual(9);
    }
  });
});

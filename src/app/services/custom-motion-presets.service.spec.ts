import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION_SETTINGS } from '../models/motion-settings.model';
import { parseCustomPresets } from './custom-motion-presets.service';

describe('custom motion presets persistence', () => {
  const preset = {
    id: 'local-1',
    name: 'My Matchday',
    settings: { ...DEFAULT_MOTION_SETTINGS, trailStrength: 92, glowEnabled: true },
  };

  it('restores valid settings snapshots', () => {
    expect(parseCustomPresets(JSON.stringify([preset]))).toEqual([preset]);
  });

  it('ignores malformed and out-of-range saved settings', () => {
    expect(parseCustomPresets('not JSON')).toEqual([]);
    expect(parseCustomPresets(JSON.stringify([{ ...preset, settings: {
      ...preset.settings, glowBlur: -1,
    } }]))).toEqual([]);
    expect(parseCustomPresets(JSON.stringify([{ ...preset, settings: {
      ...preset.settings, trailColor: 'not-a-color',
    } }]))).toEqual([]);
  });

  it('ignores unknown entries and limits the collection', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      ...preset, id: String(i), name: `Preset ${i}`,
    }));
    expect(parseCustomPresets(JSON.stringify([...items, { bogus: true }]))).toHaveLength(30);
  });
});

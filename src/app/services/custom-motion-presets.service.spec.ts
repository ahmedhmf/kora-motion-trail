import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION_SETTINGS } from '../models/motion-settings.model';
import { parseCustomPresets } from './custom-motion-presets.service';

describe('custom motion presets persistence', () => {
  const preset = {
    id: 'local-1',
    name: 'My Matchday',
    settings: { ...DEFAULT_MOTION_SETTINGS, trailStrength: 92, glowEnabled: true },
  };

  it('migrates older presets without advanced fields', () => {
    const legacy = { ...preset.settings } as Partial<typeof preset.settings>;
    delete legacy.trailDistance;
    delete legacy.trailSpacing;
    delete legacy.directionAngle;
    delete legacy.trailFadeCurve;
    delete legacy.echoScale;
    legacy.direction = 'up';
    const restored = parseCustomPresets(JSON.stringify([{ ...preset, settings: legacy }]));
    expect(restored).toHaveLength(1);
    expect(restored[0].settings.direction).toBe('up');
    expect(restored[0].settings.directionAngle).toBe(90);
    expect(restored[0].settings.trailDistance).toBe(100);
    expect(restored[0].settings.trailFadeCurve).toBe('classic');
    expect(restored[0].settings.echoScale).toBe(100);
    expect(restored[0].settings.glowEnabled).toBe(true);
  });

  it('rejects out-of-range advanced values', () => {
    const invalid = { ...preset, settings: { ...preset.settings, directionAngle: 999 } };
    expect(parseCustomPresets(JSON.stringify([invalid]))).toEqual([]);
  });

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

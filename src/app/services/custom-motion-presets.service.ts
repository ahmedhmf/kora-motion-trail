import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_MOTION_SETTINGS, MotionSettings, DIRECTION_ANGLES, MotionDirection,
} from '../models/motion-settings.model';

export interface CustomMotionPreset {
  id: string;
  name: string;
  settings: MotionSettings;
}

const STORAGE_KEY = 'football-art-lab.motion-presets.v1';
const LIMIT = 30;
const settingKeys = Object.keys(DEFAULT_MOTION_SETTINGS) as (keyof MotionSettings)[];

// Upgrade browser presets saved before Advanced Motion existed, without losing
// the user's original direction, colors or glow. Never mutate saved snapshots.
export function normalizeMotionSettings(value: Partial<MotionSettings>): MotionSettings {
  const direction = value.direction && value.direction in DIRECTION_ANGLES
    ? value.direction : DEFAULT_MOTION_SETTINGS.direction;
  return {
    ...DEFAULT_MOTION_SETTINGS,
    ...value,
    direction,
    directionAngle: value.directionAngle ?? DIRECTION_ANGLES[direction as MotionDirection],
  };
}

function validSettings(value: unknown): value is MotionSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Record<string, unknown>;
  const percentFields = [
    'intensity', 'preservation', 'visibility', 'trailStrength', 'glowIntensity',
  ];
  if (!percentFields.every((key) =>
    typeof settings[key] === 'number' &&
    Number.isFinite(settings[key]) &&
    (settings[key] as number) >= 0 &&
    (settings[key] as number) <= 100
  )) return false;
  if (typeof settings['layers'] !== 'number' ||
    !Number.isInteger(settings['layers']) ||
    settings['layers'] < 1 || settings['layers'] > 30) return false;
  if (!['left', 'right', 'up', 'down'].includes(String(settings['direction']))) return false;
  if (!['original', 'solid', 'gradient'].includes(String(settings['trailColorMode']))) return false;
  if (typeof settings['trailColor'] !== 'string' ||
    !/^#[0-9a-fA-F]{6}$/.test(settings['trailColor'])) return false;
  if (typeof settings['trailEndColor'] !== 'string' ||
    !/^#[0-9a-fA-F]{6}$/.test(settings['trailEndColor'])) return false;
  if (typeof settings['glowEnabled'] !== 'boolean') return false;
  if (typeof settings['glowBlur'] !== 'number' ||
    !Number.isFinite(settings['glowBlur']) ||
    settings['glowBlur'] < 0 || settings['glowBlur'] > 100) return false;
  const advancedRanges: readonly [string, number, number][] = [
    ['trailDistance', 0, 200],
    ['directionAngle', 0, 360],
    ['echoScale', 50, 150],
    ['pathCurve', -100, 100],
    ['echoRotation', -45, 45],
    ['directionalBlur', 0, 30],
  ];
  if (!advancedRanges.every(([key, min, max]) =>
    typeof settings[key] === 'number' && Number.isFinite(settings[key]) &&
    (settings[key] as number) >= min && (settings[key] as number) <= max
  )) return false;
  if (!['tight', 'normal', 'wide'].includes(String(settings['trailSpacing']))) return false;
  if (!['classic', 'linear', 'smooth', 'sharp', 'constant']
    .includes(String(settings['trailFadeCurve']))) return false;
  return settingKeys.every((key) => key in settings);
}

export function parseCustomPresets(raw: string | null): CustomMotionPreset[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CustomMotionPreset => {
      if (!item || typeof item !== 'object') return false;
      const entry = item as Record<string, unknown>;
      return typeof entry['id'] === 'string' &&
        entry['id'].length > 0 && entry['id'].length <= 100 &&
        typeof entry['name'] === 'string' &&
        entry['name'].trim().length > 0 &&
        entry['name'].length <= 40 &&
        !!entry['settings'] && typeof entry['settings'] === 'object' &&
        validSettings(normalizeMotionSettings(entry['settings'] as Partial<MotionSettings>));
    }).slice(0, LIMIT).map((item) => ({
      id: item.id,
      name: item.name,
      settings: normalizeMotionSettings(item.settings),
    }));
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class CustomMotionPresetsService {
  readonly presets = signal<CustomMotionPreset[]>(this.load());

  private load(): CustomMotionPreset[] {
    try {
      return typeof localStorage === 'undefined'
        ? [] : parseCustomPresets(localStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  }

  save(name: string, settings: MotionSettings): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) {
      throw new Error('Preset name must be between 1 and 40 characters.');
    }
    if (!validSettings(settings)) {
      throw new Error('The motion settings cannot be saved.');
    }
    if (this.presets().length >= LIMIT) {
      throw new Error('You can save up to 30 custom presets.');
    }
    if (this.presets().some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A preset with that name already exists.');
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next = [...this.presets(), {
      id, name: trimmed, settings: { ...settings },
    }];
    this.persist(next);
    this.presets.set(next);
  }

  remove(id: string): void {
    const next = this.presets().filter((preset) => preset.id !== id);
    if (next.length === this.presets().length) return;
    this.persist(next);
    this.presets.set(next);
  }

  private persist(presets: CustomMotionPreset[]): void {
    try {
      if (typeof localStorage === 'undefined') {
        throw new Error('Browser storage is unavailable.');
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch {
      throw new Error('Could not save presets in this browser. Check storage permissions.');
    }
  }
}

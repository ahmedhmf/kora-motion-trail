import { DEFAULT_MOTION_SETTINGS, MotionSettings } from './motion-settings.model';

export type MotionPresetId =
  | 'classic'
  | 'cinematic-echo'
  | 'speed-burst'
  | 'ghost-motion'
  | 'neon-runner';

export interface MotionPreset {
  id: MotionPresetId;
  label: string;
  description: string;
  settings: Readonly<MotionSettings>;
}

// Complete settings snapshots avoid carrying color/glow values from a previous preset.
export const MOTION_PRESETS: readonly MotionPreset[] = [
  {
    id: 'classic',
    label: 'Classic Echo',
    description: 'Original colors and strong, recognizable silhouettes',
    settings: { ...DEFAULT_MOTION_SETTINGS },
  },
  {
    id: 'cinematic-echo',
    label: 'Cinematic Echo',
    description: 'Layered, natural-color echoes with dramatic depth',
    settings: {
      ...DEFAULT_MOTION_SETTINGS,
      intensity: 75,
      preservation: 85,
      layers: 12,
      trailStrength: 90,
      glowEnabled: false,
    },
  },
  {
    id: 'speed-burst',
    label: 'Speed Burst',
    description: 'Long, densely packed echoes for intense movement',
    settings: {
      ...DEFAULT_MOTION_SETTINGS,
      intensity: 100,
      preservation: 65,
      layers: 18,
      trailStrength: 95,
      direction: 'left',
      glowEnabled: false,
    },
  },
  {
    id: 'ghost-motion',
    label: 'Ghost Motion',
    description: 'Cool violet silhouettes with a soft atmospheric glow',
    settings: {
      ...DEFAULT_MOTION_SETTINGS,
      intensity: 70,
      preservation: 90,
      layers: 11,
      trailStrength: 65,
      trailColorMode: 'solid',
      trailColor: '#a78bfa',
      glowEnabled: true,
      glowIntensity: 45,
      glowBlur: 24,
    },
  },
  {
    id: 'neon-runner',
    label: 'Neon Runner',
    description: 'Electric cyan trails with a bright neon glow',
    settings: {
      ...DEFAULT_MOTION_SETTINGS,
      intensity: 85,
      preservation: 75,
      layers: 13,
      trailStrength: 90,
      trailColorMode: 'solid',
      trailColor: '#00e5ff',
      glowEnabled: true,
      glowIntensity: 90,
      glowBlur: 26,
    },
  },
];

export function findMatchingMotionPreset(settings: MotionSettings): MotionPresetId | null {
  const keys = Object.keys(DEFAULT_MOTION_SETTINGS) as (keyof MotionSettings)[];
  return MOTION_PRESETS.find((preset) =>
    keys.every((key) => preset.settings[key] === settings[key]),
  )?.id ?? null;
}

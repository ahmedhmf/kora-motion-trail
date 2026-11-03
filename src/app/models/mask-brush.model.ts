export type MaskBrushMode = 'add' | 'erase';

export interface MaskBrushSettings {
  mode: MaskBrushMode;
  size: number;
}

export const DEFAULT_MASK_BRUSH: MaskBrushSettings = {
  mode: 'add',
  size: 24
};

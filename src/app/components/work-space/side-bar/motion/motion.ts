import { Component, ElementRef, inject, output, signal, ViewChild } from '@angular/core';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import { EditorStore } from '../../../../stores/editor.store';
import { MotionSettings, MotionDirection, DEFAULT_MOTION_SETTINGS } from '../../../../models/motion-settings.model';
import { CustomMotionPresetsService } from '../../../../services/custom-motion-presets.service';
import {
  MOTION_PRESETS,
  MotionPresetId,
  findMatchingMotionPreset,
} from '../../../../models/motion-presets.model';

@Component({
  imports: [CollapsibleSection],
  selector: 'app-motion',
  styleUrl: './motion.css',
  templateUrl: './motion.html',
})
export class Motion {
  readonly editorStore = inject(EditorStore);

  readonly stopAnimation = output<void>();
  readonly presets = MOTION_PRESETS;
  readonly customPresets = inject(CustomMotionPresetsService);
  readonly isSaveDialogOpen = signal(false);
  readonly newPresetName = signal('');
  readonly presetError = signal<string | null>(null);

  @ViewChild('presetNameInput') private presetNameInput?: ElementRef<HTMLInputElement>;

  activeCustomPresetId(): string | null {
    const current = this.editorStore.motionSettings();
    const keys = Object.keys(DEFAULT_MOTION_SETTINGS) as (keyof MotionSettings)[];
    return this.customPresets.presets().find((preset) =>
      keys.every((key) => preset.settings[key] === current[key]),
    )?.id ?? null;
  }

  applyCustomPreset(id: string): void {
    const preset = this.customPresets.presets().find((item) => item.id === id);
    if (preset) this.updateEffect({ ...preset.settings });
  }

  removeCustomPreset(id: string): void {
    try {
      this.customPresets.remove(id);
      this.presetError.set(null);
    } catch (error) {
      this.presetError.set(error instanceof Error ? error.message : 'Could not delete preset.');
    }
  }

  openSaveDialog(): void {
    this.newPresetName.set('');
    this.presetError.set(null);
    this.isSaveDialogOpen.set(true);
    setTimeout(() => this.presetNameInput?.nativeElement.focus(), 0);
  }

  closeSaveDialog(): void {
    this.isSaveDialogOpen.set(false);
    this.presetError.set(null);
  }

  saveCustomPreset(event: Event): void {
    event.preventDefault();
    try {
      this.customPresets.save(this.newPresetName(), this.editorStore.motionSettings());
      this.closeSaveDialog();
    } catch (error) {
      this.presetError.set(error instanceof Error ? error.message : 'Could not save preset.');
    }
  }

  isCustomSettings(): boolean {
    return !this.activePreset() && !this.activeCustomPresetId();
  }


  activePreset(): MotionPresetId | null {
    return findMatchingMotionPreset(this.editorStore.motionSettings());
  }

  applyPreset(id: MotionPresetId): void {
    const preset = MOTION_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    this.updateEffect({ ...preset.settings });
  }

  updateIntensity(event: Event): void {
    this.updateEffect({ intensity: Number((event.target as HTMLInputElement).value) });
  }

  updatePreservation(event: Event): void {
    this.updateEffect({ preservation: Number((event.target as HTMLInputElement).value) });
  }

  updateLayers(event: Event): void {
    this.updateEffect({ layers: Number((event.target as HTMLInputElement).value) });
  }

  updateDirection(event: Event): void {
    const direction = (event.target as HTMLSelectElement).value;
    if (!['left', 'right', 'up', 'down'].includes(direction)) return;
    this.updateEffect({ direction: direction as MotionDirection });
  }


   updateTrailStrength(event: Event): void {
    const strength = Number((event.target as HTMLInputElement).value);

    this.updateEffect({
      trailStrength: strength,
    });
  }

    updateTrailVisibility(event: Event): void {
    const visibility = Number((event.target as HTMLInputElement).value);

    this.updateEffect({
      visibility,
    });
  }
  updateTrailColorMode(event: Event): void {
    const mode = (event.target as HTMLSelectElement).value;
    if (mode !== 'original' && mode !== 'solid') return;
    this.updateEffect({ trailColorMode: mode });
  }

  updateTrailColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    this.updateEffect({ trailColor: color });
  }

  updateGlowEnabled(event: Event): void {
    this.updateEffect({ glowEnabled: (event.target as HTMLInputElement).checked });
  }

  updateGlowIntensity(event: Event): void {
    this.updateEffect({ glowIntensity: Number((event.target as HTMLInputElement).value) });
  }

  updateGlowBlur(event: Event): void {
    this.updateEffect({ glowBlur: Number((event.target as HTMLInputElement).value) });
  }

  resetEffects(): void {
    this.stopAnimation.emit();
    this.editorStore.resetMotionSettings();
  }

  private updateEffect(changes: Partial<MotionSettings>): void {
    this.stopAnimation.emit();
    this.editorStore.updateMotionSettings(changes);
  }

}

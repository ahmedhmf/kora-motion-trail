import { Component, ElementRef, inject, output, signal, ViewChild } from '@angular/core';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import { EditorStore } from '../../../../stores/editor.store';
import {
  MotionSettings, MotionDirection, DEFAULT_MOTION_SETTINGS, DIRECTION_ANGLES,
  TrailFadeCurve, TrailSpacing,
} from '../../../../models/motion-settings.model';
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

  selectSubject(subject: 'player' | 'ball'): void {
    this.stopAnimation.emit();
    this.editorStore.setActiveSubject(subject);
  }

  startBallRefinement(): void {
    this.stopAnimation.emit();
    this.editorStore.startBallMaskRefinement();
  }

  cancelBallRefinement(): void {
    this.editorStore.cancelBallMaskRefinement();
  }

  applyBallRefinement(): void {
    this.editorStore.applyBallMaskRefinement();
  }

  setBallBrushMode(mode: 'add' | 'erase'): void {
    this.editorStore.setBallBrushMode(mode);
  }

  updateBallBrushSize(event: Event): void {
    this.editorStore.setBallBrushSize(Number((event.target as HTMLInputElement).value));
  }

  toggleBallOverlay(event: Event): void {
    this.editorStore.setBallMaskOverlayVisible((event.target as HTMLInputElement).checked);
  }

  updateDetectedBallScale(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.stopAnimation.emit();
    this.editorStore.setBallMaskScale(value);
  }

  updateBallRadius(event: Event): void {
    const radius = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(radius)) return;
    this.stopAnimation.emit();
    this.editorStore.updateBallRadius(radius);
  }

  clearBall(): void {
    this.stopAnimation.emit();
    this.editorStore.clearBallSelection();
  }


  readonly stopAnimation = output<void>();
  readonly presets = MOTION_PRESETS;
  readonly customPresets = inject(CustomMotionPresetsService);
  readonly isSaveDialogOpen = signal(false);
  readonly newPresetName = signal('');
  readonly presetError = signal<string | null>(null);

  @ViewChild('presetNameInput') private presetNameInput?: ElementRef<HTMLInputElement>;

  activeCustomPresetId(): string | null {
    const current = this.editorStore.currentMotionSettings();
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
      this.customPresets.save(this.newPresetName(), this.editorStore.currentMotionSettings());
      this.closeSaveDialog();
    } catch (error) {
      this.presetError.set(error instanceof Error ? error.message : 'Could not save preset.');
    }
  }

  isCustomSettings(): boolean {
    return !this.activePreset() && !this.activeCustomPresetId();
  }


  activePreset(): MotionPresetId | null {
    return findMatchingMotionPreset(this.editorStore.currentMotionSettings());
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
    this.updateEffect({ direction: direction as MotionDirection, directionAngle: DIRECTION_ANGLES[direction as MotionDirection] });
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
  updateTrailDistance(event: Event): void {
    this.updateEffect({ trailDistance: Number((event.target as HTMLInputElement).value) });
  }

  updateTrailSpacing(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!['tight', 'normal', 'wide'].includes(value)) return;
    this.updateEffect({ trailSpacing: value as TrailSpacing });
  }

  updateDirectionAngle(event: Event): void {
    const directionAngle = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(directionAngle)) return;
    this.updateEffect({ directionAngle });
  }

  updateTrailFadeCurve(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!['classic', 'linear', 'smooth', 'sharp', 'constant'].includes(value)) return;
    this.updateEffect({ trailFadeCurve: value as TrailFadeCurve });
  }

  updateEchoScale(event: Event): void {
    this.updateEffect({ echoScale: Number((event.target as HTMLInputElement).value) });
  }

  updatePathCurve(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.updateEffect({ pathCurve: Math.max(-100, Math.min(100, value)) });
    }
  }

  updateEchoRotation(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.updateEffect({ echoRotation: Math.max(-45, Math.min(45, value)) });
    }
  }

  resetAdvancedMotion(): void {
    this.updateEffect({
      trailDistance: DEFAULT_MOTION_SETTINGS.trailDistance,
      trailSpacing: DEFAULT_MOTION_SETTINGS.trailSpacing,
      directionAngle: DIRECTION_ANGLES[this.editorStore.currentMotionSettings().direction],
      trailFadeCurve: DEFAULT_MOTION_SETTINGS.trailFadeCurve,
      echoScale: DEFAULT_MOTION_SETTINGS.echoScale,
      pathCurve: DEFAULT_MOTION_SETTINGS.pathCurve,
      echoRotation: DEFAULT_MOTION_SETTINGS.echoRotation,
    });
  }

  updateTrailColorMode(event: Event): void {
    const mode = (event.target as HTMLSelectElement).value;
    if (mode !== 'original' && mode !== 'solid' && mode !== 'gradient') return;
    this.updateEffect({ trailColorMode: mode });
  }

  updateTrailColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    this.updateEffect({ trailColor: color });
  }

  updateTrailEndColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    this.updateEffect({ trailEndColor: color });
  }

  updateDirectionalBlur(event: Event): void {
    const amount = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(amount)) return;
    this.updateEffect({ directionalBlur: Math.max(0, Math.min(30, amount)) });
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

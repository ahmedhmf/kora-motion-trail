import { Component, inject, output } from '@angular/core';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import { EditorStore } from '../../../../stores/editor.store';
import { MotionSettings } from '../../../../models/motion-settings.model';

@Component({
  imports: [CollapsibleSection],
  selector: 'app-motion',
  styleUrl: './motion.css',
  templateUrl: './motion.html',
})
export class Motion {
  readonly editorStore = inject(EditorStore);

  readonly stopAnimation = output<void>();

   updateTrailStrength(event: Event): void {
    const strength = Number((event.target as HTMLInputElement).value);

    this.stopAnimation.emit();

    this.editorStore.updateMotionSettings({
      trailStrength: strength,
    });
  }

    updateTrailVisibility(event: Event): void {
    const visibility = Number((event.target as HTMLInputElement).value);

    this.stopAnimation.emit();

    this.editorStore.updateMotionSettings({
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

import { Component, inject, output } from '@angular/core';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import { EditorStore } from '../../../../stores/editor.store';

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
}

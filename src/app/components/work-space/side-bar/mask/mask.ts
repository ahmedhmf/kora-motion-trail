import { Component, inject, signal } from '@angular/core';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import { EditorStore } from '../../../../stores/editor.store';

@Component({
  imports: [CollapsibleSection],
  selector: 'app-mask',
  styleUrl: './mask.css',
  templateUrl: './mask.html',
})
export class Mask {
  readonly editorStore = inject(EditorStore);

  readonly showMask = signal(false);
  readonly isEditingMask = signal(false);

  async detectPlayer(): Promise<void> {
    this.showMask.set(false);
    this.isEditingMask.set(false);

    await this.editorStore.detectPlayer();
  }

  toggleMaskPreview(): void {
    if (!this.editorStore.playerMask()) return;

    this.isEditingMask.set(false);
    this.showMask.update((value) => !value);
  }
}

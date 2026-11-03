import { Component, signal, inject, output } from '@angular/core';
import { EditorStore } from '../../../../stores/editor.store';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import {
  DEFAULT_VIDEO_EXPORT_SETTINGS,
  VideoExportSettings,
} from '../../../../models/video-export-settings.model';

@Component({
  imports: [CollapsibleSection],
  selector: 'app-animation',
  styleUrl: './animation.css',
  templateUrl: './animation.html',
})
export class Animation {
  readonly editorStore = inject(EditorStore);
  readonly videoSettings = signal<VideoExportSettings>({
    ...DEFAULT_VIDEO_EXPORT_SETTINGS,
  });

  readonly stopAnimation = output<void>();
  readonly playAnimation = output<void>();

  readonly isPlaying = signal(false);

  updateAnimationStyle(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (value !== 'reveal' && value !== 'pulse' && value !== 'loop') {
      return;
    }

    this.stopAnimation.emit();

    this.videoSettings.update((settings) => ({
      ...settings,
      animationStyle: value,
    }));
  }

  updateVideoDuration(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);

    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    this.stopAnimation.emit();

    this.videoSettings.update((settings) => ({
      ...settings,
      durationSeconds: value,
    }));
  }
}

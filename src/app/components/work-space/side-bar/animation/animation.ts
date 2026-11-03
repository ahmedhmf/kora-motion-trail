import { Component, inject, input, output } from '@angular/core';
import { EditorStore } from '../../../../stores/editor.store';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import { VideoExportSettings } from '../../../../models/video-export-settings.model';

@Component({
  imports: [CollapsibleSection],
  selector: 'app-animation',
  styleUrl: './animation.css',
  templateUrl: './animation.html',
})
export class Animation {
  readonly editorStore = inject(EditorStore);
  readonly videoSettings = input.required<VideoExportSettings>();
  readonly isPlaying = input(false);

  readonly stopAnimation = output<void>();
  readonly playAnimation = output<void>();
  readonly updateVideoSettings = output<VideoExportSettings>();

  updateAnimationStyle(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (value !== 'reveal' && value !== 'pulse' && value !== 'loop') {
      return;
    }

    this.stopAnimation.emit();
    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      animationStyle: value,
    });
  }

  updateVideoDuration(event: Event): void {
    const duration = Number((event.target as HTMLSelectElement).value);

    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    this.stopAnimation.emit();
    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      durationSeconds: duration,
    });
  }
}

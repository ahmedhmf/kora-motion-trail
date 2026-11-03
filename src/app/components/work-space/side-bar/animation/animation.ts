import { Component, inject, input, output } from '@angular/core';
import { EditorStore } from '../../../../stores/editor.store';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import {
  AnimationEasing,
  AnimationSpeed,
  AnimationStyle,
  VideoExportSettings,
} from '../../../../models/video-export-settings.model';
import { getEffectiveDurationSeconds } from '../../../../services/animation-timing';
import { ANIMATION_STYLES } from '../../../../services/motion-animation.service';

@Component({
  imports: [CollapsibleSection],
  selector: 'app-animation',
  styleUrl: './animation.css',
  templateUrl: './animation.html',
})
export class Animation {
  readonly editorStore = inject(EditorStore);
  readonly styles = ANIMATION_STYLES;
  readonly speeds: readonly AnimationSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
  readonly easings: readonly { value: AnimationEasing; label: string }[] = [
    { value: 'linear', label: 'Linear (constant pace)' },
    { value: 'ease-in', label: 'Ease In (slow start)' },
    { value: 'ease-out', label: 'Ease Out (slow finish)' },
    { value: 'ease-in-out', label: 'Ease In-Out (cinematic)' },
  ];

  actualDurationSeconds(): number {
    return getEffectiveDurationSeconds(this.videoSettings());
  }

  updateAnimationSpeed(event: Event): void {
    const speed = Number((event.target as HTMLSelectElement).value);
    if (!this.speeds.includes(speed as AnimationSpeed)) return;
    this.stopAnimation.emit();
    this.updateVideoSettings.emit({ ...this.videoSettings(), speed: speed as AnimationSpeed });
  }

  updateAnimationEasing(event: Event): void {
    const easing = (event.target as HTMLSelectElement).value;
    if (!this.easings.some((option) => option.value === easing)) return;
    this.stopAnimation.emit();
    this.updateVideoSettings.emit({ ...this.videoSettings(), easing: easing as AnimationEasing });
  }

  readonly videoSettings = input.required<VideoExportSettings>();
  readonly isPlaying = input(false);

  readonly stopAnimation = output<void>();
  readonly playAnimation = output<void>();
  readonly updateVideoSettings = output<VideoExportSettings>();

  updateAnimationStyle(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (!this.styles.some((style) => style.id === value)) {
      return;
    }

    this.stopAnimation.emit();
    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      animationStyle: value as AnimationStyle,
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

import { Component, input, output } from '@angular/core';
import { Mask } from './mask/mask';
import { Motion } from './motion/motion';
import { Animation } from './animation/animation';
import { VideoExportSettings } from '../../../models/video-export-settings.model';
import { Export } from './export/export';

@Component({
  imports: [Mask, Motion, Animation, Export],
  selector: 'app-side-bar',
  styleUrl: './side-bar.css',
  templateUrl: './side-bar.html',
})
export class SideBar {
  readonly videoSettings = input.required<VideoExportSettings>();
  readonly stopAnimation = output<void>();
  readonly playAnimation = output<void>();
  readonly updateVideoSettings = output<VideoExportSettings>();


  onStopAnimation(): void {
    this.stopAnimation.emit();
  }

  onPlayAnimation(): void {
    this.playAnimation.emit();
  }

  onUpdateVideoSettings(settings: VideoExportSettings): void {
    this.updateVideoSettings.emit(settings);
  }
}

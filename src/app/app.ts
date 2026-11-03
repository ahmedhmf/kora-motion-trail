import { Component, inject, signal } from '@angular/core';
import { EditorStore } from './stores/editor.store';
import { MotionAnimationService } from './services/motion-animation.service';
import { WorkSpace } from './components/work-space/work-space';
import { VideoLab } from './components/video-lab/video-lab';

@Component({
  selector: 'app-root',
  imports: [WorkSpace, VideoLab],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly editorMode = signal<'photo' | 'video'>('photo');
}

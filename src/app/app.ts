import { Component, inject, signal } from '@angular/core';
import { EditorStore } from './stores/editor.store';
import { MotionAnimationService } from './services/motion-animation.service';
import { WorkSpace } from './components/work-space/work-space';

@Component({
  selector: 'app-root',
  imports: [WorkSpace],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
}

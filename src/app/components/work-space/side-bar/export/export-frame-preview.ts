import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';
import { VideoExportSettings } from '../../../../models/video-export-settings.model';
import {
  drawExportFrame,
  getExportDimensions,
  getExportGeometry,
} from '../../../../services/export-layout';

@Component({
  selector: 'app-export-frame-preview',
  standalone: true,
  template: `
    <div class="flex justify-center rounded-lg bg-zinc-950 p-2">
      <canvas
        #canvas
        class="block h-auto max-w-full cursor-grab rounded border border-zinc-700 touch-none active:cursor-grabbing"
        [class.cursor-not-allowed]="disabled"
        aria-label="Export crop preview. Drag to reposition the photograph."
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerEnd($event)"
        (pointercancel)="onPointerEnd($event)"
        (lostpointercapture)="onPointerEnd($event)"
      ></canvas>
    </div>
  `,
})
export class ExportFramePreview implements AfterViewInit, OnChanges {
  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() source: HTMLCanvasElement | HTMLImageElement | null = null;
  @Input() disabled = false;
  @Input({ required: true }) settings!: VideoExportSettings;
  @Output() positionChange = new EventEmitter<{ offsetX: number; offsetY: number }>();

  private ready = false;
  private drag: {
    pointerId: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null = null;

  ngAfterViewInit(): void {
    this.ready = true;
    this.draw();
  }

  ngOnChanges(): void {
    if (this.ready) this.draw();
  }

  private sourceDimensions(): { width: number; height: number } | null {
    if (!this.source) return null;
    if (this.source instanceof HTMLCanvasElement) {
      return { width: this.source.width, height: this.source.height };
    }
    return { width: this.source.naturalWidth, height: this.source.naturalHeight };
  }

  private draw(): void {
    if (!this.ready) return;
    const canvas = this.canvasRef.nativeElement;
    const dimensions = this.sourceDimensions();

    if (!dimensions || !dimensions.width || !dimensions.height) {
      canvas.width = 1;
      canvas.height = 1;
      return;
    }

    const output = getExportDimensions(
      dimensions.width,
      dimensions.height,
      this.settings.resolution,
      this.settings.aspectRatio,
    );
    const scale = Math.min(1, 300 / Math.max(output.width, output.height));
    const width = Math.max(1, Math.round(output.width * scale));
    const height = Math.max(1, Math.round(output.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawExportFrame(
      ctx, this.source!, dimensions.width, dimensions.height,
      width, height, this.settings,
    );
  }

  onPointerDown(event: PointerEvent): void {
    if (this.disabled || !this.source || !this.sourceDimensions()) return;
    const canvas = this.canvasRef.nativeElement;
    this.drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: this.settings.offsetX,
      offsetY: this.settings.offsetY,
    };
    canvas.setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    const dimensions = this.sourceDimensions();
    if (!drag || drag.pointerId !== event.pointerId || !dimensions) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const geometry = getExportGeometry(
      dimensions.width, dimensions.height,
      canvas.width, canvas.height, this.settings,
    );

    const dx = (event.clientX - drag.x) * canvas.width / rect.width;
    const dy = (event.clientY - drag.y) * canvas.height / rect.height;
    const clamp = (value: number) => Math.max(-100, Math.min(100, value));
    this.positionChange.emit({
      offsetX: geometry.travelX > 0.001
        ? clamp(drag.offsetX + dx / geometry.travelX * 100)
        : drag.offsetX,
      offsetY: geometry.travelY > 0.001
        ? clamp(drag.offsetY + dy / geometry.travelY * 100)
        : drag.offsetY,
    });
  }

  onPointerEnd(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      this.drag = null;
    }
  }
}

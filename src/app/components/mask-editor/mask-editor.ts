import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { UploadedImage } from '../../models/uploaded-image.model';

@Component({
  imports: [],
  selector: 'app-mask-editor',
  styleUrl: './mask-editor.css',
  templateUrl: './mask-editor.html',
})
export class MaskEditor implements AfterViewInit {
  @ViewChild('editorCanvas')
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  @Output()
  maskChanged = new EventEmitter<HTMLCanvasElement>();

  private currentImage: UploadedImage | null = null;
  private currentMask: HTMLCanvasElement | null = null;

  private workingMask: HTMLCanvasElement | null = null;

  private viewReady = false;

  @Input()
  set image(value: UploadedImage | null) {
    this.currentImage = value;
    this.prepareWorkingMask();
  }

  @Input()
  set mask(value: HTMLCanvasElement | null) {
    this.currentMask = value;
    this.prepareWorkingMask();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  private prepareWorkingMask(): void {
    if (!this.currentImage || !this.currentMask) {
      this.workingMask = null;
      if (this.viewReady) this.render();
      return;
    }

    const canvas = document.createElement('canvas');

    canvas.width = this.currentImage.width;
    canvas.height = this.currentImage.height;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(this.currentMask, 0, 0, canvas.width, canvas.height);

    this.workingMask = canvas;

    if (this.viewReady) this.render();
  }

  private render(): void {
    if (!this.viewReady || !this.currentImage) return;

    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    const ctx = canvas.getContext('2d');

    if (!container || !ctx) return;

    const maxWidth = Math.min(container.clientWidth, 1200);
    const maxHeight = 700;

    if (maxWidth <= 0) return;

    const scale = Math.min(
      maxWidth / this.currentImage.width,
      maxHeight / this.currentImage.height,
      1,
    );

    const width = Math.max(1, Math.round(this.currentImage.width * scale));

    const height = Math.max(1, Math.round(this.currentImage.height * scale));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    ctx.drawImage(this.currentImage.image, 0, 0, width, height);

    if (!this.workingMask) return;

    // Create a temporary cyan mask overlay.
    const overlay = document.createElement('canvas');
    overlay.width = width;
    overlay.height = height;

    const overlayCtx = overlay.getContext('2d');
    if (!overlayCtx) return;

    overlayCtx.fillStyle = '#00d9ff';
    overlayCtx.fillRect(0, 0, width, height);

    const maskPixels = this.workingMask
      .getContext('2d')
      ?.getImageData(0, 0, this.workingMask.width, this.workingMask.height);

    if (!maskPixels) return;

    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = this.workingMask.width;
    alphaCanvas.height = this.workingMask.height;

    const alphaCtx = alphaCanvas.getContext('2d');
    if (!alphaCtx) return;

    for (let i = 0; i < maskPixels.data.length; i += 4) {
      const brightness = maskPixels.data[i];

      maskPixels.data[i] = 255;
      maskPixels.data[i + 1] = 255;
      maskPixels.data[i + 2] = 255;
      maskPixels.data[i + 3] = brightness;
    }

    alphaCtx.putImageData(maskPixels, 0, 0);

    overlayCtx.globalCompositeOperation = 'destination-in';
    overlayCtx.drawImage(alphaCanvas, 0, 0, width, height);

    overlayCtx.globalCompositeOperation = 'source-over';

    ctx.globalAlpha = 0.45;
    ctx.drawImage(overlay, 0, 0);
    ctx.globalAlpha = 1;
  }

  private getPoint(event: PointerEvent): {
    x: number;
    y: number;
  } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (this.currentImage!.width / rect.width),

      y: (event.clientY - rect.top) * (this.currentImage!.height / rect.height),
    };
  }

}

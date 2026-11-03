import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, Input, EventEmitter, Output } from '@angular/core';
import { UploadedImage } from '../../models/uploaded-image.model';

@Component({
  imports: [],
  selector: 'app-artwork-canvas',
  styleUrls: ['./artwork-canvas.css'],
  templateUrl: './artwork-canvas.html',
})
export class ArtworkCanvas implements AfterViewInit, OnDestroy {
  @ViewChild('canvas')
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private currentImage: UploadedImage | null = null;
  private resizeObserver?: ResizeObserver;
  private viewReady = false;
  private currentMask: HTMLCanvasElement | null = null;
  private maskVisible = false;
  private currentProcessedImage: HTMLCanvasElement | null = null;
  private currentAnimationFrame: HTMLCanvasElement | null = null;

  @Input()
  set image(value: UploadedImage | null) {
    this.currentImage = value;

    if (this.viewReady) {
      this.drawImage();
    }
  }

  @Input()
  set mask(value: HTMLCanvasElement | null) {
    this.currentMask = value;
    if (this.viewReady) this.drawImage();
  }

  @Input()
  set showMask(value: boolean) {
    this.maskVisible = value;
    if (this.viewReady) this.drawImage();
  }

  @Input()
  set processedImage(value: HTMLCanvasElement | null) {
    this.currentProcessedImage = value;
    this.drawImage();
  }

  @Input()
  set animationFrame(value: HTMLCanvasElement | null) {
    this.currentAnimationFrame = value;
    this.drawImage();
  }

  @Input() showPlayerControls = false;
  @Input() isPlaying = false;
  @Input() progress = 0;
  @Input() durationSeconds = 5;

  @Output() playRequested = new EventEmitter<void>();
  @Output() pauseRequested = new EventEmitter<void>();
  @Output() replayRequested = new EventEmitter<void>();
  @Output() seekRequested = new EventEmitter<number>();

  get currentTime(): number {
    return this.progress * this.durationSeconds;
  }

  formatTime(seconds: number): string {
    const total = Math.floor(seconds);

    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;

    return (
      `${minutes.toString().padStart(2, '0')}:` + `${remainingSeconds.toString().padStart(2, '0')}`
    );
  }

  onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.seekRequested.emit(Number(input.value) / 1000);
  }

  togglePlayback(): void {
    if (this.isPlaying) {
      this.pauseRequested.emit();
    } else {
      this.playRequested.emit();
    }
  }

  ngAfterViewInit(): void {
    this.viewReady = true;

    const canvas = this.canvasRef.nativeElement;

    this.resizeObserver = new ResizeObserver(() => {
      this.drawImage();
    });

    if (canvas.parentElement) {
      this.resizeObserver.observe(canvas.parentElement);
    }

    this.drawImage();
  }

  private drawImage(): void {
    if (!this.currentImage || !this.viewReady) return;

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

    canvas.width = width;
    canvas.height = height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const source =
      this.maskVisible && this.currentMask ? this.currentMask : this.currentImage.image;

    if (this.currentAnimationFrame) {
      ctx.drawImage(this.currentAnimationFrame, 0, 0, width, height);
    } else if (this.maskVisible && this.currentMask) {
      ctx.drawImage(this.currentMask, 0, 0, width, height);
    } else if (this.currentProcessedImage) {
      ctx.drawImage(this.currentProcessedImage, 0, 0, width, height);
    } else {
      ctx.drawImage(this.currentImage.image, 0, 0, width, height);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}

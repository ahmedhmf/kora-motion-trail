import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, Input, EventEmitter, Output } from '@angular/core';
import { UploadedImage } from '../../models/uploaded-image.model';
import { MotionSettings } from '../../models/motion-settings.model';
import { BallSelection, MotionSubject } from '../../models/subject-selection.model';
import { getEchoLayout } from '../../services/advanced-motion-layout';

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
  private currentMotion: MotionSettings | null = null;
  private ball: BallSelection | null = null;
  private subject: MotionSubject = 'player';
  private anchor = { x: 0, y: 0 };
  private dragging: 'end' | 'curve' | null = null;
  private lastDragValue = '';
  private refining = false;
  private draftMask: HTMLCanvasElement | null = null;
  private showDraftOverlay = true;
  private draftOverlay: HTMLCanvasElement | null = null;
  private paintingPointer: number | null = null;
  private lastPaintPoint: { x: number; y: number } | null = null;
  private brushDiameter = 24;

  @Input() set refiningBallMask(value: boolean) {
    this.refining = value;
    if (!value) {
      this.paintingPointer = null;
      this.lastPaintPoint = null;
    }
    if (this.viewReady) this.drawImage();
  }
  get refiningBallMask(): boolean { return this.refining; }

  @Input() set ballMaskDraft(value: HTMLCanvasElement | null) {
    this.draftMask = value;
    this.draftOverlay = null;
    if (this.viewReady) this.drawImage();
  }
  @Input() set ballMaskRevision(_value: number) {
    this.draftOverlay = null;
    if (this.viewReady) this.drawImage();
  }
  @Input() set showBallMaskOverlay(value: boolean) {
    this.showDraftOverlay = value;
    if (this.viewReady) this.drawImage();
  }
  @Input() set ballBrushSize(value: number) { this.brushDiameter = value; }
  @Output() ballMaskPaint = new EventEmitter<{
    from: { x: number; y: number };
    to: { x: number; y: number };
  }>();

  private selectionMode = false;
  private pathEditMode = false;
  @Input() set selectingBall(value: boolean) {
    this.selectionMode = value;
    if (this.viewReady) this.drawImage();
  }
  get selectingBall(): boolean { return this.selectionMode; }
  @Input() set editingMotion(value: boolean) {
    this.pathEditMode = value;
    if (!value) this.dragging = null;
    if (this.viewReady) this.drawImage();
  }
  get editingMotion(): boolean { return this.pathEditMode; }
  @Input() set motionSettings(value: MotionSettings | null) {
    this.currentMotion = value;
    if (this.viewReady) this.drawImage();
  }
  @Input() set ballSelection(value: BallSelection | null) {
    this.ball = value;
    if (this.viewReady) this.drawImage();
  }
  @Input() set selectedSubject(value: MotionSubject) {
    this.subject = value;
    if (this.viewReady) this.drawImage();
  }
  @Output() ballPicked = new EventEmitter<{ x: number; y: number }>();
  @Output() motionPathChanged = new EventEmitter<Partial<MotionSettings>>();

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
    if (value) {
      const data = value.getContext('2d')?.getImageData(0, 0, value.width, value.height);
      if (data) {
        let minX = value.width, minY = value.height, maxX = -1, maxY = -1;
        for (let i = 0; i < data.data.length; i += 4) {
          if (data.data[i] <= 10) continue;
          const index = i / 4, x = index % value.width, y = Math.floor(index / value.width);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        this.anchor = maxX >= 0 ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
          : { x: value.width / 2, y: value.height / 2 };
      }
    }
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

  private point(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const bounds = canvas.getBoundingClientRect();
    const image = this.currentImage!;
    return {
      x: (event.clientX - bounds.left) * image.width / bounds.width,
      y: (event.clientY - bounds.top) * image.height / bounds.height,
    };
  }

  private motionAnchor(): { x: number; y: number } {
    return this.subject === 'ball' && this.ball ? this.ball : this.anchor;
  }

  private guides() {
    if (!this.currentImage || !this.currentMotion) return null;
    const a = this.motionAnchor(), m = this.currentMotion;
    const mid = getEchoLayout(m.layers / 2, m.layers,
      this.currentImage.width, this.currentImage.height, m, a.x, a.y);
    const end = getEchoLayout(m.layers, m.layers,
      this.currentImage.width, this.currentImage.height, m, a.x, a.y);
    return { start: a, mid, end };
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.currentImage) return;
    const p = this.point(event);
    if (this.refining && this.draftMask) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      this.paintingPointer = event.pointerId;
      this.lastPaintPoint = p;
      this.canvasRef.nativeElement.setPointerCapture(event.pointerId);
      this.ballMaskPaint.emit({ from: p, to: p });
      event.preventDefault();
      return;
    }
    if (this.selectingBall) {
      this.ballPicked.emit(p);
      return;
    }
    if (!this.editingMotion) return;
    const guides = this.guides();
    if (!guides) return;
    const distance = (x: number, y: number) => Math.hypot(p.x - x, p.y - y);
    const threshold = 26 * this.currentImage.width / this.canvasRef.nativeElement.width;
    const endDistance = distance(guides.end.pivotX, guides.end.pivotY);
    const midDistance = distance(guides.mid.pivotX, guides.mid.pivotY);
    this.dragging = endDistance <= threshold && endDistance <= midDistance
      ? 'end' : midDistance <= threshold ? 'curve' : null;
    if (this.dragging) {
      this.lastDragValue = '';
      this.canvasRef.nativeElement.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (this.refining && this.paintingPointer === event.pointerId &&
        this.lastPaintPoint && this.currentImage) {
      const p = this.point(event);
      this.ballMaskPaint.emit({ from: this.lastPaintPoint, to: p });
      this.lastPaintPoint = p;
      event.preventDefault();
      return;
    }
    if (!this.dragging || !this.currentImage || !this.currentMotion) return;
    const p = this.point(event);
    const a = this.motionAnchor(), m = this.currentMotion;
    const dx = p.x - a.x, dy = p.y - a.y;
    if (this.dragging === 'end') {
      const base = Math.min(this.currentImage.width, this.currentImage.height) *
        0.45 * m.intensity / 100;
      this.emitDrag({
        directionAngle: Math.round((Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360),
        trailDistance: Math.round(Math.max(0, Math.min(200,
          base > 0 ? 100 * Math.hypot(dx, dy) / base : m.trailDistance))),
      });
    } else {
      const baseline = getEchoLayout(m.layers / 2, m.layers,
        this.currentImage.width, this.currentImage.height, { ...m, pathCurve: 0 }, a.x, a.y);
      const angle = m.directionAngle * Math.PI / 180;
      const sideways = (p.x - baseline.pivotX) * Math.sin(angle) +
        (p.y - baseline.pivotY) * Math.cos(angle);
      const power = m.trailSpacing === 'tight' ? 1.6
        : m.trailSpacing === 'wide' ? 0.65 : 1;
      const t = Math.pow(0.5, power);
      const amplitude = Math.min(this.currentImage.width, this.currentImage.height) *
        0.45 * m.intensity / 100 * m.trailDistance / 100 * 0.65 * 4 * t * (1 - t);
      if (amplitude > 0) this.emitDrag({
        pathCurve: Math.round(Math.max(-100, Math.min(100, sideways / amplitude * 100))),
      });
    }
    event.preventDefault();
  }

  private emitDrag(changes: Partial<MotionSettings>): void {
    const key = JSON.stringify(changes);
    if (key === this.lastDragValue) return;
    this.lastDragValue = key;
    this.motionPathChanged.emit(changes);
  }

  onPointerUp(event: PointerEvent): void {
    if (this.paintingPointer === event.pointerId) {
      this.paintingPointer = null;
      this.lastPaintPoint = null;
    }
    this.dragging = null;
    this.lastDragValue = '';
    const canvas = this.canvasRef.nativeElement;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  private getDraftOverlay(): HTMLCanvasElement | null {
    const mask = this.draftMask;
    if (!mask) return null;
    if (this.draftOverlay) return this.draftOverlay;
    const source = mask.getContext('2d');
    if (!source) return null;
    const pixels = source.getImageData(0, 0, mask.width, mask.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      // Mask brightness indicates membership; display as cyan on top of photo.
      const alpha = Math.round(pixels.data[i] * 0.55);
      pixels.data[i] = 34;
      pixels.data[i + 1] = 211;
      pixels.data[i + 2] = 238;
      pixels.data[i + 3] = alpha;
    }
    const overlay = document.createElement('canvas');
    overlay.width = mask.width;
    overlay.height = mask.height;
    overlay.getContext('2d')?.putImageData(pixels, 0, 0);
    this.draftOverlay = overlay;
    return overlay;
  }

  private drawGuides(ctx: CanvasRenderingContext2D, width: number): void {
    if (!this.currentImage) return;
    const scale = width / this.currentImage.width;
    if (this.selectingBall && this.ball) {
      ctx.save(); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]); ctx.beginPath();
      ctx.arc(this.ball.x * scale, this.ball.y * scale, this.ball.radius * scale, 0, Math.PI * 2);
      ctx.stroke(); ctx.restore();
    }
    if (!this.editingMotion || this.selectingBall) return;
    const g = this.guides();
    if (!g) return;
    ctx.save(); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]); ctx.beginPath();
    ctx.moveTo(g.start.x * scale, g.start.y * scale);
    ctx.quadraticCurveTo(
      (2 * g.mid.pivotX - (g.start.x + g.end.pivotX) / 2) * scale,
      (2 * g.mid.pivotY - (g.start.y + g.end.pivotY) / 2) * scale,
      g.end.pivotX * scale, g.end.pivotY * scale,
    );
    ctx.stroke(); ctx.setLineDash([]);
    for (const [x, y, color] of [
      [g.mid.pivotX, g.mid.pivotY, '#facc15'],
      [g.end.pivotX, g.end.pivotY, '#22d3ee'],
    ] as const) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x * scale, y * scale, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

    if (this.refining) {
      // Edit against the source image, not the processed trails or a mask-only
      // view, so boundaries can be corrected precisely.
      ctx.drawImage(this.currentImage.image, 0, 0, width, height);
      if (this.showDraftOverlay) {
        const overlay = this.getDraftOverlay();
        if (overlay) ctx.drawImage(overlay, 0, 0, width, height);
      }
    } else if (this.currentAnimationFrame) {
      ctx.drawImage(this.currentAnimationFrame, 0, 0, width, height);
    } else if (this.maskVisible && this.currentMask) {
      ctx.drawImage(this.currentMask, 0, 0, width, height);
    } else if (this.currentProcessedImage) {
      ctx.drawImage(this.currentProcessedImage, 0, 0, width, height);
    } else {
      ctx.drawImage(this.currentImage.image, 0, 0, width, height);
    }
    if (!this.refining) this.drawGuides(ctx, width);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}

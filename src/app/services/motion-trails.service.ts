import { Injectable } from '@angular/core';

import { MotionSettings } from '../models/motion-settings.model';
import { EchoLayout, getEchoLayout } from './advanced-motion-layout';

@Injectable({
  providedIn: 'root',
})
export class MotionTrailsService {
  // Cache only the current image/mask pair to avoid retaining old large canvases.
  private cachedSubject: {
    image: HTMLImageElement;
    mask: HTMLCanvasElement;
    canvas: HTMLCanvasElement;
  } | null = null;

  private subjectAnchor: { x: number; y: number } | null = null;

  private coloredSubject: {
    source: HTMLCanvasElement;
    color: string;
    canvas: HTMLCanvasElement;
  } | null = null;
  private glowSubject: {
    source: HTMLCanvasElement;
    blur: number;
    canvas: HTMLCanvasElement;
    padding: number;
  } | null = null;

  invalidateSubjectCache(): void {
    this.cachedSubject = null;
    this.subjectAnchor = null;
    this.coloredSubject = null;
    this.glowSubject = null;
  }

  private getColoredSubject(subject: HTMLCanvasElement, color: string): HTMLCanvasElement {
    if (this.coloredSubject?.source === subject && this.coloredSubject.color === color) {
      return this.coloredSubject.canvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = subject.width;
    canvas.height = subject.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create colored trail canvas.');

    ctx.drawImage(subject, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    this.coloredSubject = { source: subject, color, canvas };
    this.glowSubject = null;
    return canvas;
  }

  private getGlowSubject(source: HTMLCanvasElement, blur: number): {
    canvas: HTMLCanvasElement;
    padding: number;
  } {
    if (this.glowSubject?.source === source && this.glowSubject.blur === blur) {
      return this.glowSubject;
    }

    // Blur is constructed only when its source or radius changes, not each frame.
    const padding = Math.ceil(blur * 3);
    const canvas = document.createElement('canvas');
    canvas.width = source.width + padding * 2;
    canvas.height = source.height + padding * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create trail glow canvas.');

    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(source, padding, padding);
    ctx.filter = 'none';

    this.glowSubject = { source, blur, canvas, padding };
    return this.glowSubject;
  }

  private getSubject(image: HTMLImageElement, mask: HTMLCanvasElement): HTMLCanvasElement {
    const cached = this.cachedSubject;

    if (
      cached &&
      cached.image === image &&
      cached.mask === mask &&
      cached.canvas.width === image.naturalWidth &&
      cached.canvas.height === image.naturalHeight
    ) {
      return cached.canvas;
    }

    const canvas = this.extractSubject(image, mask);
    this.cachedSubject = { image, mask, canvas };
    return canvas;
  }

  render(
    image: HTMLImageElement,
    mask: HTMLCanvasElement,
    settings: MotionSettings,
  ): HTMLCanvasElement {
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;

    const ctx = output.getContext('2d');

    if (!ctx) {
      throw new Error('Could not create artwork canvas.');
    }

    const subject = this.getSubject(image, mask);
    const trailSource = settings.trailColorMode === 'solid'
      ? this.getColoredSubject(subject, settings.trailColor)
      : subject;
    const glowBlur = Math.max(0, Math.min(100, settings.glowBlur));
    const glow = settings.glowEnabled && glowBlur > 0
      ? this.getGlowSubject(trailSource, glowBlur)
      : null;
    const glowIntensity = Math.max(0, Math.min(1, settings.glowIntensity / 100));

    // Original photograph as background.
    ctx.drawImage(image, 0, 0, width, height);

    const intensity = Math.max(0, Math.min(1, settings.intensity / 100));

    const preservation = Math.max(0, Math.min(1, settings.preservation / 100));

    const layers = Math.max(1, Math.round(settings.layers));

    const visibility = Math.max(0, Math.min(1, settings.visibility / 100));
    const baseTrailStrength = intensity * (1 - preservation * 0.65) * (settings.visibility / 100);
    const echoStrength = Math.max(0, Math.min(1, settings.trailStrength / 100));
    // The previous implementation allocated and blurred a full-size canvas
    // here, but never drew it. Avoid that work on every animation frame.

    // -------------------------------------
    // PASS 1: Continuous directional streaks
    // -------------------------------------

    for (let i = layers; i >= 1; i--) {
      const echo = getEchoLayout(
        i, layers, width, height, settings,
        this.subjectAnchor?.x, this.subjectAnchor?.y,
      );

      // Strong echoes, including distant copies.
      const fade = echo.fade;

      // Trail Strength directly controls opacity.
      // Preservation and intensity no longer
      // weaken the repeated silhouettes.
      const opacity = Math.min(1, echoStrength * visibility * fade);

      if (glow && glowIntensity > 0) {
        this.drawEcho(ctx, glow.canvas, echo, Math.min(1, opacity * glowIntensity),
          glow.padding, this.subjectAnchor?.x ?? width / 2, this.subjectAnchor?.y ?? height / 2);
      }
      this.drawEcho(ctx, trailSource, echo, opacity, 0,
        this.subjectAnchor?.x ?? width / 2, this.subjectAnchor?.y ?? height / 2);
    }

    // -------------------------------------
    // PASS 2: Recognizable motion echoes
    // -------------------------------------

    for (let i = layers; i >= 1; i--) {
      const echo = getEchoLayout(
        i, layers, width, height, settings,
        this.subjectAnchor?.x, this.subjectAnchor?.y,
      );

      // Gentle fading keeps distant echoes recognizable.
      const fade = echo.secondaryFade;

      // User controls how strong the repeated silhouettes are.
      const opacity = baseTrailStrength * echoStrength * fade * 0.012;

      this.drawEcho(ctx, trailSource, echo, opacity, 0,
        this.subjectAnchor?.x ?? width / 2, this.subjectAnchor?.y ?? height / 2);
    }

    // -------------------------------------
    // PASS 3: Sharp foreground
    // -------------------------------------

    ctx.drawImage(subject, 0, 0, width, height);

    return output;
  }

  private drawEcho(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    echo: EchoLayout,
    opacity: number,
    padding: number,
    anchorX: number,
    anchorY: number,
  ): void {
    if (opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Rotate the whole masked silhouette (and glow) around the same detected
    // subject centre. A zero angle preserves the previous drawing geometry.
    ctx.translate(echo.pivotX, echo.pivotY);
    ctx.rotate(echo.rotationRadians);
    ctx.drawImage(
      source,
      -(anchorX + padding) * echo.scale,
      -(anchorY + padding) * echo.scale,
      source.width * echo.scale,
      source.height * echo.scale,
    );
    ctx.restore();
  }

  private extractSubject(image: HTMLImageElement, mask: HTMLCanvasElement): HTMLCanvasElement {
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const subject = document.createElement('canvas');
    subject.width = width;
    subject.height = height;

    const ctx = subject.getContext('2d');

    if (!ctx) {
      throw new Error('Could not extract subject.');
    }

    // Draw original photograph.
    ctx.drawImage(image, 0, 0, width, height);

    // Convert opaque grayscale mask brightness to alpha.
    const maskDataCanvas = document.createElement('canvas');
    maskDataCanvas.width = width;
    maskDataCanvas.height = height;

    const maskCtx = maskDataCanvas.getContext('2d');

    if (!maskCtx) {
      throw new Error('Could not read mask.');
    }

    maskCtx.drawImage(mask, 0, 0, width, height);

    const imageData = maskCtx.getImageData(0, 0, width, height);

    const pixels = imageData.data;
    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let i = 0; i < pixels.length; i += 4) {
      // White mask = opaque subject.
      // Black mask = transparent background.
      const brightness = pixels[i];
      if (brightness > 10) {
        const pixel = i / 4;
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }

      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = brightness;
    }

    this.subjectAnchor = maxX >= minX
      ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
      : { x: width / 2, y: height / 2 };

    maskCtx.putImageData(imageData, 0, 0);

    // Keep only the player and ball.
    ctx.globalCompositeOperation = 'destination-in';

    ctx.drawImage(maskDataCanvas, 0, 0, width, height);

    ctx.globalCompositeOperation = 'source-over';

    return subject;
  }

}

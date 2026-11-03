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

  // Keep at most two tint/blur variants for a gradient. Never accumulate
  // canvases across images or when the user experiments with colors.
  private coloredSubjects: Array<{
    source: HTMLCanvasElement;
    color: string;
    canvas: HTMLCanvasElement;
  }> = [];
  private glowSubjects: Array<{
    source: HTMLCanvasElement;
    blur: number;
    canvas: HTMLCanvasElement;
    padding: number;
  }> = [];
  private streakSubjects: Array<{
    source: HTMLCanvasElement;
    amount: number;
    angle: number;
    canvas: HTMLCanvasElement;
    padding: number;
  }> = [];

  invalidateSubjectCache(): void {
    this.cachedSubject = null;
    this.subjectAnchor = null;
    this.coloredSubjects = [];
    this.glowSubjects = [];
    this.streakSubjects = [];
  }

  private getColoredSubject(subject: HTMLCanvasElement, color: string): HTMLCanvasElement {
    const cached = this.coloredSubjects.find((entry) =>
      entry.source === subject && entry.color === color);
    if (cached) return cached.canvas;

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

    this.coloredSubjects.push({ source: subject, color, canvas });
    if (this.coloredSubjects.length > 2) this.coloredSubjects.shift();
    return canvas;
  }

  private getGlowSubject(source: HTMLCanvasElement, blur: number): {
    canvas: HTMLCanvasElement;
    padding: number;
  } {
    const cached = this.glowSubjects.find((entry) =>
      entry.source === source && entry.blur === blur);
    if (cached) return cached;

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

    const result = { source, blur, canvas, padding };
    this.glowSubjects.push(result);
    if (this.glowSubjects.length > 2) this.glowSubjects.shift();
    return result;
  }

  private getDirectionalStreak(
    source: HTMLCanvasElement,
    amount: number,
    angle: number,
  ): { canvas: HTMLCanvasElement; padding: number } {
    const cached = this.streakSubjects.find((entry) =>
      entry.source === source && entry.amount === amount && entry.angle === angle);
    if (cached) return cached;
    const padding = Math.ceil(amount) + 2;
    const canvas = document.createElement('canvas');
    canvas.width = source.width + padding * 2;
    canvas.height = source.height + padding * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not render directional motion blur.');

    const radians = angle * Math.PI / 180;
    // Multiple translucent copies form a one-directional streak rather than
    // the uniform halo produced by canvas filter: blur().
    for (let step = 8; step >= 1; step--) {
      const fraction = step / 8;
      ctx.globalAlpha = 0.2 * (1 - fraction * 0.6);
      ctx.drawImage(
        source,
        padding + Math.cos(radians) * amount * fraction,
        padding - Math.sin(radians) * amount * fraction,
      );
    }
    ctx.globalAlpha = 1;
    const result = { source, amount, angle, canvas, padding };
    this.streakSubjects.push(result);
    if (this.streakSubjects.length > 2) this.streakSubjects.shift();
    return result;
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
    const gradient = settings.trailColorMode === 'gradient';
    const primarySource = settings.trailColorMode === 'original'
      ? subject : this.getColoredSubject(subject, settings.trailColor);
    const secondarySource = gradient
      ? this.getColoredSubject(subject, settings.trailEndColor)
      : null;
    const glowBlur = Math.max(0, Math.min(100, settings.glowBlur));
    const blurAmount = Math.max(0, Math.min(30, settings.directionalBlur));
    const glowIntensity = Math.max(0, Math.min(1, settings.glowIntensity / 100));
    const anchorX = this.subjectAnchor?.x ?? width / 2;
    const anchorY = this.subjectAnchor?.y ?? height / 2;

    // Cached per active color. The two gradient endpoints are composited with
    // weights based on echo distance, avoiding per-frame pixel processing.
    const drawTrail = (echo: EchoLayout, opacity: number, streaks: boolean): void => {
      if (opacity <= 0) return;
      const progress = echo.progress;
      const sources: Array<{ source: HTMLCanvasElement; weight: number }> =
        secondarySource
          ? [{ source: primarySource, weight: 1 - progress },
             { source: secondarySource, weight: progress }]
          : [{ source: primarySource, weight: 1 }];
      for (const { source, weight } of sources) {
        if (weight <= 0) continue;
        const alpha = opacity * weight;
        if (settings.glowEnabled && glowBlur > 0 && glowIntensity > 0) {
          const glow = this.getGlowSubject(source, glowBlur);
          this.drawEcho(ctx, glow.canvas, echo, Math.min(1, alpha * glowIntensity),
            glow.padding, anchorX, anchorY);
        }
        if (streaks && blurAmount > 0) {
          const streak = this.getDirectionalStreak(source, blurAmount, settings.directionAngle);
          this.drawEcho(ctx, streak.canvas, echo, alpha * 0.75,
            streak.padding, anchorX, anchorY);
        }
        this.drawEcho(ctx, source, echo, alpha, 0, anchorX, anchorY);
      }
    };

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

      drawTrail(echo, opacity, true);
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

      drawTrail(echo, opacity, false);
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

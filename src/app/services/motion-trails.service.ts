import { Injectable } from '@angular/core';

import { MotionSettings } from '../models/motion-settings.model';

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

    const direction = this.getDirection(settings.direction);

    const maxDistance = Math.min(width, height) * 0.45 * intensity;

    const visibility = Math.max(0, Math.min(1, settings.visibility / 100));
    const baseTrailStrength = intensity * (1 - preservation * 0.65) * (settings.visibility / 100);
    const echoStrength = Math.max(0, Math.min(1, settings.trailStrength / 100));
    // The previous implementation allocated and blurred a full-size canvas
    // here, but never drew it. Avoid that work on every animation frame.

    // -------------------------------------
    // PASS 1: Continuous directional streaks
    // -------------------------------------

    for (let i = layers; i >= 1; i--) {
      const progress = i / layers;

      const distance = maxDistance * progress;

      const offsetX = direction.x * distance;
      const offsetY = direction.y * distance;

      // Strong echoes, including distant copies.
      const fade = 1 - progress * 0.35;

      // Trail Strength directly controls opacity.
      // Preservation and intensity no longer
      // weaken the repeated silhouettes.
      const opacity = Math.min(1, echoStrength * visibility * fade);

      ctx.save();
      if (glow && glowIntensity > 0) {
        ctx.globalAlpha = Math.min(1, opacity * glowIntensity);
        ctx.drawImage(glow.canvas, offsetX - glow.padding, offsetY - glow.padding);
      }
      ctx.globalAlpha = opacity;
      ctx.drawImage(trailSource, offsetX, offsetY, width, height);
      ctx.restore();
    }

    // -------------------------------------
    // PASS 2: Recognizable motion echoes
    // -------------------------------------

    for (let i = layers; i >= 1; i--) {
      const progress = i / layers;

      const distance = maxDistance * progress;

      const offsetX = direction.x * distance;
      const offsetY = direction.y * distance;

      // Gentle fading keeps distant echoes recognizable.
      const fade = Math.pow(1 - progress, 0.65);

      // User controls how strong the repeated silhouettes are.
      const opacity = baseTrailStrength * echoStrength * fade * 0.012;

      ctx.save();

      ctx.globalAlpha = opacity;

      ctx.drawImage(trailSource, offsetX, offsetY, width, height);

      ctx.restore();
    }

    // -------------------------------------
    // PASS 3: Sharp foreground
    // -------------------------------------

    ctx.drawImage(subject, 0, 0, width, height);

    return output;
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

    for (let i = 0; i < pixels.length; i += 4) {
      // White mask = opaque subject.
      // Black mask = transparent background.
      const brightness = pixels[i];

      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = brightness;
    }

    maskCtx.putImageData(imageData, 0, 0);

    // Keep only the player and ball.
    ctx.globalCompositeOperation = 'destination-in';

    ctx.drawImage(maskDataCanvas, 0, 0, width, height);

    ctx.globalCompositeOperation = 'source-over';

    return subject;
  }

  private getDirection(direction: MotionSettings['direction']): { x: number; y: number } {
    switch (direction) {
      case 'left':
        return { x: -1, y: 0 };

      case 'right':
        return { x: 1, y: 0 };

      case 'up':
        return { x: 0, y: -1 };

      case 'down':
        return { x: 0, y: 1 };
    }
  }
}

import { Injectable } from '@angular/core';

import { MotionSettings } from '../models/motion-settings.model';

@Injectable({
  providedIn: 'root',
})
export class MotionTrailsService {
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

    const subject = this.extractSubject(image, mask);

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
    // Create a blurred subject for soft streaks.
    const blurredSubject = document.createElement('canvas');
    blurredSubject.width = width;
    blurredSubject.height = height;

    const blurCtx = blurredSubject.getContext('2d');

    if (!blurCtx) {
      throw new Error('Could not create blur canvas.');
    }

    const blurRadius = Math.min(width, height) * 0.004 * intensity;

    blurCtx.filter = `blur(${blurRadius}px)`;

    // Leave room for blur around the subject.
    // For this MVP, the blur remains clipped at image edges.
    blurCtx.drawImage(subject, 0, 0);

    blurCtx.filter = 'none';

    // -------------------------------------
    // PASS 1: Continuous directional streaks
    // -------------------------------------

    // Dense sampling creates a smoother trail.
    const streakSteps = Math.max(30, Math.min(120, Math.round(maxDistance / 5)));

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
      ctx.globalAlpha = opacity;

      ctx.drawImage(subject, offsetX, offsetY, width, height);

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

      ctx.drawImage(subject, offsetX, offsetY, width, height);

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

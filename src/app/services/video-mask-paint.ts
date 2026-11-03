import type { TrackCenter } from './subject-tracking';
import type { VideoCorrectionKeyframe } from './video-correction-keyframes';

/** Opaque black mask, following the renderer's grayscale-mask convention. */
export function blankVideoMask(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create video mask.');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

export function maskBrightness(mask: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = mask.getContext('2d');
  if (!ctx) throw new Error('Could not inspect mask.');
  const rgba = ctx.getImageData(0, 0, mask.width, mask.height).data;
  const brightness = new Uint8ClampedArray(mask.width * mask.height);
  for (let pixel = 0; pixel < brightness.length; pixel++) {
    brightness[pixel] = Math.round(rgba[pixel * 4] * rgba[pixel * 4 + 3] / 255);
  }
  return brightness;
}

export function videoMaskFromBrightness(
  brightness: Uint8ClampedArray, width: number, height: number,
): HTMLCanvasElement {
  if (brightness.length !== width * height) throw new Error('Invalid video mask dimensions.');
  const canvas = blankVideoMask(width, height);
  const ctx = canvas.getContext('2d')!;
  const data = ctx.createImageData(width, height);
  for (let i = 0; i < brightness.length; i++) {
    const index = i * 4;
    data.data[index] = brightness[i];
    data.data[index + 1] = brightness[i];
    data.data[index + 2] = brightness[i];
    data.data[index + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** Paint edits remain separate from the original YOLO segmentation.
 * At neighboring frames, only changed pixels (add OR erase) propagate.
 * Unchanged areas continue to use that frame's actual YOLO segmentation.
 */
export function propagatePaintedMask(
  originalAtKeyframe: HTMLCanvasElement | null,
  paintedAtKeyframe: HTMLCanvasElement,
  targetOriginal: HTMLCanvasElement | null,
  offset: TrackCenter,
  influence: number,
): HTMLCanvasElement {
  const width = paintedAtKeyframe.width;
  const height = paintedAtKeyframe.height;
  if ((originalAtKeyframe && (originalAtKeyframe.width !== width ||
      originalAtKeyframe.height !== height)) ||
      (targetOriginal && (targetOriginal.width !== width ||
      targetOriginal.height !== height))) {
    throw new Error('Video mask sizes must match.');
  }
  const initial = originalAtKeyframe
    ? maskBrightness(originalAtKeyframe)
    : new Uint8ClampedArray(width * height);
  const painted = maskBrightness(paintedAtKeyframe);
  const target = targetOriginal
    ? maskBrightness(targetOriginal)
    : new Uint8ClampedArray(width * height);
  const amount = Math.max(0, Math.min(1, influence));
  const shiftX = Math.round(offset.x);
  const shiftY = Math.round(offset.y);
  for (let y = 0; y < height; y++) {
    const targetY = y + shiftY;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < width; x++) {
      const delta = painted[y * width + x] - initial[y * width + x];
      if (!delta) continue;
      const targetX = x + shiftX;
      if (targetX < 0 || targetX >= width) continue;
      const index = targetY * width + targetX;
      target[index] = Math.max(0, Math.min(255,
        Math.round(target[index] + delta * amount)));
    }
  }
  return videoMaskFromBrightness(target, width, height);
}

export function translateVideoMask(
  source: HTMLCanvasElement, offset: TrackCenter,
): HTMLCanvasElement {
  const brightness = maskBrightness(source);
  const shifted = new Uint8ClampedArray(brightness.length);
  const dx = Math.round(offset.x);
  const dy = Math.round(offset.y);
  for (let y = 0; y < source.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= source.height) continue;
    for (let x = 0; x < source.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= source.width) continue;
      shifted[ty * source.width + tx] = brightness[y * source.width + x];
    }
  }
  return videoMaskFromBrightness(shifted, source.width, source.height);
}

export function maskCenter(mask: HTMLCanvasElement): TrackCenter | null {
  const data = maskBrightness(mask);
  let totalX = 0, totalY = 0, count = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < 80) continue;
    totalX += i % mask.width;
    totalY += Math.floor(i / mask.width);
    count++;
  }
  return count ? { x: totalX / count, y: totalY / count } : null;
}

export type PaintedCorrection = VideoCorrectionKeyframe & {
  paintedMask: HTMLCanvasElement;
};

import type { TrackCenter, TrackedSubject } from './subject-tracking';
import type { SegmentedClipFrame } from './video-clip-frames.service';
import { combineSubjectMasks, excludeBallFromPlayer } from './subject-masks';

export const CORRECTION_PROPAGATION_FRAMES = 2;

export interface VideoCorrectionKeyframe {
  subject: TrackedSubject;
  frame: number;
  center: TrackCenter;
  /** Only used to create a manual circular ball mask when no ball was detected. */
  radius: number;
}

export function validCorrection(
  correction: VideoCorrectionKeyframe, length: number, width: number, height: number,
): boolean {
  return Number.isInteger(correction.frame) && correction.frame >= 0 &&
    correction.frame < length && Number.isFinite(correction.center.x) &&
    Number.isFinite(correction.center.y) &&
    correction.center.x >= 0 && correction.center.x <= width &&
    correction.center.y >= 0 && correction.center.y <= height &&
    Number.isFinite(correction.radius) && correction.radius >= 2 &&
    correction.radius <= Math.min(width, height) / 2;
}

/** A new correction replaces only the same subject and exact frame. */
export function upsertCorrection(
  corrections: readonly VideoCorrectionKeyframe[],
  correction: VideoCorrectionKeyframe,
): VideoCorrectionKeyframe[] {
  return [
    ...corrections.filter((item) =>
      item.subject !== correction.subject || item.frame !== correction.frame),
    correction,
  ].sort((a, b) => a.frame - b.frame ||
    a.subject.localeCompare(b.subject));
}

/** Do not propagate through another keyframe or farther than two frames.
 * Ties use the earlier correction, ensuring stable scrub / export results.
 */
export function nearestCorrection(
  corrections: readonly VideoCorrectionKeyframe[],
  subject: TrackedSubject,
  index: number,
): { keyframe: VideoCorrectionKeyframe; influence: number } | null {
  const candidates = corrections
    .filter((key) => key.subject === subject &&
      Math.abs(key.frame - index) <= CORRECTION_PROPAGATION_FRAMES)
    .sort((a, b) => Math.abs(a.frame - index) - Math.abs(b.frame - index) ||
      a.frame - b.frame);
  if (!candidates.length) return null;
  const keyframe = candidates[0];
  const distance = Math.abs(keyframe.frame - index);
  return {
    keyframe,
    influence: distance === 0 ? 1 : (CORRECTION_PROPAGATION_FRAMES + 1 - distance) /
      (CORRECTION_PROPAGATION_FRAMES + 1),
  };
}

function emptyMask(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create corrected mask.');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

function moveMask(
  original: HTMLCanvasElement,
  dx: number,
  dy: number,
): HTMLCanvasElement {
  const canvas = emptyMask(original.width, original.height);
  const ctx = canvas.getContext('2d')!;
  // Masks are opaque grayscale with a black background. Use lightening
  // instead of ordinary source-over to keep black background black.
  ctx.globalCompositeOperation = 'lighten';
  ctx.drawImage(original, dx, dy);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

function circleMask(
  width: number, height: number, center: TrackCenter, radius: number,
): HTMLCanvasElement {
  const canvas = emptyMask(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
  ctx.fill();
  return canvas;
}

function hasForeground(canvas: HTMLCanvasElement | null): boolean {
  if (!canvas) return false;
  const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels) return false;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 80) return true;
  }
  return false;
}

/** Derives corrected frames from immutable sampled frames, never accumulating
 * shifts on an already shifted mask. Result is usable by preview AND export.
 */
export function applyVideoCorrections(
  original: readonly SegmentedClipFrame[],
  corrections: readonly VideoCorrectionKeyframe[],
): SegmentedClipFrame[] {
  if (!original.length || !corrections.length) return [...original];
  const width = original[0].source.width;
  const height = original[0].source.height;
  for (const key of corrections) {
    if (!validCorrection(key, original.length, width, height)) {
      throw new Error('Invalid correction keyframe.');
    }
  }

  return original.map((frame, index) => {
    let player = frame.player;
    let ball = frame.ball;
    let corrected = false;

    for (const subject of ['player', 'ball'] as const) {
      const near = nearestCorrection(corrections, subject, index);
      if (!near) continue;
      const { keyframe, influence } = near;
      const keyFrame = original[keyframe.frame];
      const ownMask = subject === 'player' ? frame.player : frame.ball;
      const donorMask = subject === 'player' ? keyFrame.player : keyFrame.ball;
      const donorCenter = keyFrame.tracking?.[subject].detectedCenter ??
        keyFrame.tracking?.[subject].center ?? null;
      const currentCenter = frame.tracking?.[subject].detectedCenter ??
        frame.tracking?.[subject].center ?? null;
      let nextMask: HTMLCanvasElement | null = null;

      if (hasForeground(ownMask) && donorCenter) {
        // Smoothly fade the user correction back to YOLO's own segmentation.
        const dx = (keyframe.center.x - donorCenter.x) * influence;
        const dy = (keyframe.center.y - donorCenter.y) * influence;
        nextMask = moveMask(ownMask!, dx, dy);
      } else if (index === keyframe.frame && subject === 'ball') {
        // A manually placed ball keyframe can repair a frame with no ball.
        nextMask = circleMask(width, height, keyframe.center, keyframe.radius);
      } else if (!hasForeground(ownMask) && index !== keyframe.frame &&
                 hasForeground(donorMask)) {
        // Limited-gap propagation: copy the nearest keyframed silhouette,
        // repositioning it using available predicted tracking coordinates.
        const desired = currentCenter ?? keyframe.center;
        nextMask = moveMask(
          donorMask!,
          desired.x - (donorCenter?.x ?? keyframe.center.x),
          desired.y - (donorCenter?.y ?? keyframe.center.y),
        );
      } else if (!hasForeground(ownMask) && subject === 'ball') {
        // The correction is an explicit user-placed ball, not a YOLO inference.
        const target = currentCenter ?? keyframe.center;
        nextMask = circleMask(width, height, target, keyframe.radius);
      }

      if (!nextMask) continue;
      corrected = true;
      if (subject === 'player') player = nextMask;
      else ball = nextMask;
    }

    if (!corrected) return frame;
    // Keep the masks exclusive after translating either subject.
    if (ball) player = excludeBallFromPlayer(player, ball);
    const combined = ball ? combineSubjectMasks(player, ball) : player;
    return { ...frame, player, ball, combined };
  });
}

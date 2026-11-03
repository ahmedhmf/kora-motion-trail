/** Alpha-channel segmentation overlays are produced independently for each
 * YOLO class. Keep three explicit masks rather than reverse-engineering colors
 * from the combined RGBA overlay.
 */
export interface ClassifiedMaskData {
  player: Uint8ClampedArray;
  ball: Uint8ClampedArray;
  combined: Uint8ClampedArray;
}

export function buildClassifiedMaskData(
  playerOverlay: Uint8Array,
  ballOverlay: Uint8Array,
  width: number,
  height: number,
): ClassifiedMaskData {
  const length = width * height * 4;
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0 ||
      playerOverlay.length !== length || ballOverlay.length !== length) {
    throw new Error('YOLO returned invalid class segmentation dimensions.');
  }
  const player = new Uint8ClampedArray(length);
  const ball = new Uint8ClampedArray(length);
  const combined = new Uint8ClampedArray(length);
  for (let index = 0; index < length; index += 4) {
    // Ball pixels take precedence in overlapping detections, preventing the
    // same part of the image from receiving two independent trail effects.
    const hasBall = ballOverlay[index + 3] > 0;
    const hasPlayer = !hasBall && playerOverlay[index + 3] > 0;
    const hasCombined = hasBall || hasPlayer;
    for (const buffer of [player, ball, combined]) buffer[index + 3] = 255;
    const assign = (buffer: Uint8ClampedArray, present: boolean) => {
      const value = present ? 255 : 0;
      buffer[index] = value;
      buffer[index + 1] = value;
      buffer[index + 2] = value;
    };
    assign(player, hasPlayer);
    assign(ball, hasBall);
    assign(combined, hasCombined);
  }
  return { player, ball, combined };
}

export function hasMaskForeground(mask: Uint8ClampedArray): boolean {
  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i] > 0) return true;
  }
  return false;
}

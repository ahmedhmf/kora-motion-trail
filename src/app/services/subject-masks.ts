import { BallSelection } from '../models/subject-selection.model';

// A user-drawn ball region is extracted from the current union mask when
// segmentation contains it. An opaque circular fallback also handles photos
// where the model failed to segment the ball.
export function splitSubjectMasks(
  combined: HTMLCanvasElement,
  selection: BallSelection,
): { player: HTMLCanvasElement; ball: HTMLCanvasElement } {
  const width = combined.width, height = combined.height;
  const makeCanvas = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    return canvas;
  };
  const ball = makeCanvas(), player = makeCanvas();
  const ballCtx = ball.getContext('2d'), playerCtx = player.getContext('2d');
  if (!ballCtx || !playerCtx) throw new Error('Could not separate ball and player masks.');

  ballCtx.fillStyle = '#ffffff';
  ballCtx.beginPath();
  ballCtx.arc(selection.x, selection.y, selection.radius, 0, 2 * Math.PI);
  ballCtx.fill();

  // The player mask is the original segmentation minus the selected circle.
  playerCtx.drawImage(combined, 0, 0);
  playerCtx.globalCompositeOperation = 'destination-out';
  playerCtx.beginPath();
  playerCtx.arc(selection.x, selection.y, selection.radius, 0, 2 * Math.PI);
  playerCtx.fill();
  playerCtx.globalCompositeOperation = 'source-over';

  return { player, ball };
}

/** Recompose a grayscale union mask without black background pixels erasing
 * either subject. Called only when the user overrides the ball selection.
 */
export function combineSubjectMasks(
  player: HTMLCanvasElement,
  ball: HTMLCanvasElement,
): HTMLCanvasElement {
  if (player.width !== ball.width || player.height !== ball.height) {
    throw new Error('Cannot combine masks with different image dimensions.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = player.width;
  canvas.height = player.height;
  const ctx = canvas.getContext('2d');
  const playerCtx = player.getContext('2d');
  const ballCtx = ball.getContext('2d');
  if (!ctx || !playerCtx || !ballCtx) throw new Error('Cannot read subject masks.');
  const result = ctx.createImageData(canvas.width, canvas.height);
  const playerData = playerCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const ballData = ballCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < result.data.length; i += 4) {
    const value = Math.max(playerData[i], ballData[i]);
    result.data[i] = value;
    result.data[i + 1] = value;
    result.data[i + 2] = value;
    result.data[i + 3] = 255;
  }
  ctx.putImageData(result, 0, 0);
  return canvas;
}

export type BallBrushMode = 'add' | 'erase';

/** Use the same opaque, grayscale convention as the YOLO masks. Some manually
 * selected ball masks have a transparent background; simply painting over
 * these with destination-out would not erase the white RGB silhouette.
 */
export function cloneBallMask(source: HTMLCanvasElement): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const sourceCtx = source.getContext('2d');
  const ctx = output.getContext('2d');
  if (!sourceCtx || !ctx) throw new Error('Could not copy ball mask.');
  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = Math.round(pixels.data[i] * pixels.data[i + 3] / 255);
    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return output;
}

/** Paint continuously on the draft only. Caller owns the draft and sends
 * source-image coordinates; this never touches the committed mask.
 */
export function paintBallMaskStroke(
  draft: HTMLCanvasElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  diameter: number,
  mode: BallBrushMode,
): void {
  const ctx = draft.getContext('2d');
  if (!ctx || !Number.isFinite(diameter) || diameter <= 0 ||
      ![from.x, from.y, to.x, to.y].every(Number.isFinite)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = mode === 'add' ? '#ffffff' : '#000000';
  ctx.fillStyle = mode === 'add' ? '#ffffff' : '#000000';
  ctx.lineWidth = Math.max(1, diameter);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  // Ensure a simple tap also paints on Canvas implementations which don't
  // rasterize a zero-length stroke.
  ctx.beginPath();
  ctx.arc(to.x, to.y, Math.max(0.5, diameter / 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Composite the edited ball while keeping the player and ball mutually
 * exclusive and preserving the canonical player segmentation.
 */
export function rebuildMasksFromBall(
  playerSource: HTMLCanvasElement,
  editedBall: HTMLCanvasElement,
): { player: HTMLCanvasElement; ball: HTMLCanvasElement; combined: HTMLCanvasElement } {
  if (playerSource.width !== editedBall.width || playerSource.height !== editedBall.height) {
    throw new Error('Player and ball masks must have matching dimensions.');
  }
  const player = document.createElement('canvas');
  player.width = playerSource.width;
  player.height = playerSource.height;
  const ctx = player.getContext('2d');
  const sourceCtx = playerSource.getContext('2d');
  const ballCtx = editedBall.getContext('2d');
  if (!ctx || !sourceCtx || !ballCtx) throw new Error('Could not rebuild subject masks.');
  const pixels = sourceCtx.getImageData(0, 0, player.width, player.height);
  const ball = ballCtx.getImageData(0, 0, player.width, player.height).data;
  for (let i = 0; i < ball.length; i += 4) {
    const value = Math.max(0, pixels.data[i] - ball[i]);
    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return { player, ball: editedBall, combined: combineSubjectMasks(player, editedBall) };
}

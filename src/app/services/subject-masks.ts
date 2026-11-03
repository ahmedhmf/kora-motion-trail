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

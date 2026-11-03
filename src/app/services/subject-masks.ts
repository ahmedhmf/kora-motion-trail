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

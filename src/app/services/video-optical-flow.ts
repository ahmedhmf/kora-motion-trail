import type { TrackCenter } from './subject-tracking';

/**
 * Lightweight browser-side patch matching. This is a sparse local optical-flow
 * approximation, not an ML flow model. Operates on decoded sampled video frames.
 */
export interface GrayFrame {
  width: number;
  height: number;
  pixels: Uint8Array;
}
export interface FlowField {
  width: number;
  height: number;
  step: number;
  columns: number;
  rows: number;
  dx: Float32Array;
  dy: Float32Array;
  valid: Uint8Array;
}

export const FLOW_STEP = 8;
export const FLOW_SEARCH = 12;
const PATCH_RADIUS = 2;
const MIN_TEXTURE = 12;
const MAX_MATCH_ERROR = 30;

export function toGrayFrame(canvas: HTMLCanvasElement): GrayFrame {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot read video frame for motion matching.');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < pixels.length; i++) {
    const p = i * 4;
    pixels[i] = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
  }
  return { width: canvas.width, height: canvas.height, pixels };
}

/** Find the best local displacement for a textured image patch.
 * Reject flat or ambiguous regions rather than inventing a motion vector.
 */
export function matchPatch(
  from: GrayFrame,
  to: GrayFrame,
  x: number,
  y: number,
  search = FLOW_SEARCH,
): { dx: number; dy: number; error: number } | null {
  if (from.width !== to.width || from.height !== to.height) {
    throw new Error('Optical flow frames must have matching dimensions.');
  }
  const width = from.width, height = from.height;
  const radius = PATCH_RADIUS;
  if (x - radius < 0 || y - radius < 0 ||
      x + radius >= width || y + radius >= height) return null;

  const count = (2 * radius + 1) ** 2;
  let sum = 0, sumSquared = 0;
  for (let py = -radius; py <= radius; py++) {
    for (let px = -radius; px <= radius; px++) {
      const value = from.pixels[(y + py) * width + x + px];
      sum += value; sumSquared += value * value;
    }
  }
  const variance = sumSquared / count - (sum / count) ** 2;
  if (variance < MIN_TEXTURE) return null;

  let bestError = Number.POSITIVE_INFINITY;
  let runnerUp = Number.POSITIVE_INFINITY;
  let dxBest = 0, dyBest = 0;
  const range = Math.max(0, Math.min(24, Math.floor(search)));
  for (let dy = -range; dy <= range; dy++) {
    if (y + dy - radius < 0 || y + dy + radius >= height) continue;
    for (let dx = -range; dx <= range; dx++) {
      if (x + dx - radius < 0 || x + dx + radius >= width) continue;
      let difference = 0;
      for (let py = -radius; py <= radius; py++) {
        const src = (y + py) * width + x;
        const dst = (y + py + dy) * width + x + dx;
        for (let px = -radius; px <= radius; px++) {
          difference += Math.abs(from.pixels[src + px] - to.pixels[dst + px]);
        }
      }
      const error = difference / count;
      if (error < bestError) {
        runnerUp = bestError;
        bestError = error;
        dxBest = dx;
        dyBest = dy;
      } else if (error < runnerUp && (Math.abs(dx - dxBest) + Math.abs(dy - dyBest) > 2)) {
        runnerUp = error;
      }
    }
  }
  if (!Number.isFinite(bestError) || bestError > MAX_MATCH_ERROR) return null;
  // A non-distinct minimum commonly arises from repetitive grass/background.
  // Conservative fallbacks avoid smearing masks across the pitch.
  if (runnerUp < Number.POSITIVE_INFINITY && runnerUp - bestError < 0.65 &&
      Math.abs(dxBest) + Math.abs(dyBest) > 0) return null;
  return { dx: dxBest, dy: dyBest, error: bestError };
}

export function computeFlowField(from: GrayFrame, to: GrayFrame, step = FLOW_STEP): FlowField {
  if (from.width !== to.width || from.height !== to.height ||
      from.width * from.height !== from.pixels.length ||
      to.width * to.height !== to.pixels.length) {
    throw new Error('Optical flow frames have invalid dimensions.');
  }
  const stride = Math.max(4, Math.floor(step));
  const columns = Math.ceil(from.width / stride);
  const rows = Math.ceil(from.height / stride);
  const count = columns * rows;
  const flow: FlowField = {
    width: from.width, height: from.height, step: stride, columns, rows,
    dx: new Float32Array(count), dy: new Float32Array(count),
    valid: new Uint8Array(count),
  };
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = Math.min(from.width - 1, col * stride + Math.floor(stride / 2));
      const y = Math.min(from.height - 1, row * stride + Math.floor(stride / 2));
      const match = matchPatch(from, to, x, y);
      if (!match) continue;
      const id = row * columns + col;
      flow.dx[id] = match.dx;
      flow.dy[id] = match.dy;
      flow.valid[id] = 1;
    }
  }
  return flow;
}

export function flowAt(
  field: FlowField, x: number, y: number,
): TrackCenter | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const col = Math.max(0, Math.min(field.columns - 1, Math.floor(x / field.step)));
  const row = Math.max(0, Math.min(field.rows - 1, Math.floor(y / field.step)));
  // Search nearest valid patch inside a 3x3 neighborhood; fall back to a
  // subject-wide tracking translation where there is no reliable local match.
  let bestDistance = Number.POSITIVE_INFINITY, index = -1;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const xx = col + ox, yy = row + oy;
      if (xx < 0 || xx >= field.columns || yy < 0 || yy >= field.rows) continue;
      const id = yy * field.columns + xx;
      if (!field.valid[id]) continue;
      const distance = ox * ox + oy * oy;
      if (distance < bestDistance) { bestDistance = distance; index = id; }
    }
  }
  return index < 0 ? null : { x: field.dx[index], y: field.dy[index] };
}

export function advectMaskDelta(
  initial: Uint8ClampedArray,
  painted: Uint8ClampedArray,
  target: Uint8ClampedArray,
  width: number,
  height: number,
  flows: readonly FlowField[],
  fallback: TrackCenter,
  influence: number,
  missingTarget: boolean,
): Uint8ClampedArray {
  if (initial.length !== width * height || painted.length !== width * height ||
      target.length !== width * height ||
      flows.some((f) => f.width !== width || f.height !== height)) {
    throw new Error('Invalid optical flow mask dimensions.');
  }
  const result = new Uint8ClampedArray(target);
  const weight = Math.max(0, Math.min(1, influence));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const value = missingTarget ? painted[index] : painted[index] - initial[index];
      if (value === 0) continue;
      let tx = x, ty = y, valid = true;
      for (const flow of flows) {
        const match = flowAt(flow, tx, ty);
        if (!match) { valid = false; break; }
        tx += match.x;
        ty += match.y;
      }
      if (!valid) {
        tx = x + fallback.x;
        ty = y + fallback.y;
      }
      const xx = Math.round(tx), yy = Math.round(ty);
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const destination = yy * width + xx;
      if (missingTarget) {
        result[destination] = Math.max(result[destination], Math.round(value * weight));
      } else {
        result[destination] = Math.max(0, Math.min(255,
          Math.round(result[destination] + value * weight)));
      }
    }
  }
  return result;
}

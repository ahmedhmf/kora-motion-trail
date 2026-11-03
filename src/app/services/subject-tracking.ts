/** Lightweight, per-class single-subject tracking for the sampled video beta.
 * Tracks mask components, not YOLO box IDs. No fabricated segmentation masks
 * are emitted when an object disappears.
 */
export type TrackedSubject = 'player' | 'ball';
export type TrackStatus = 'detected' | 'predicted' | 'missing' | 'corrected';

export interface TrackBox {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

export interface TrackCenter { x: number; y: number }

export interface SubjectTrack {
  status: TrackStatus;
  center: TrackCenter | null; // Smoothed location or short-gap prediction
  detectedCenter: TrackCenter | null; // Actual detection, never synthesized
  box: TrackBox | null; // Only measured geometry, never guessed
  missedFrames: number;
}

export interface FrameTracks {
  player: SubjectTrack;
  ball: SubjectTrack;
}

export const MAX_TRACK_GAP = 2;

export function findMaskComponents(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  minArea = 2,
): TrackBox[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0 || data.length !== width * height * 4) {
    throw new Error('Mask data dimensions are invalid.');
  }
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components: TrackBox[] = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || data[start * 4] < 80) continue;
    seen[start] = 1;
    let head = 0, tail = 1, count = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    queue[0] = start;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width, y = Math.floor(index / width);
      count++;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      const visit = (neighbor: number) => {
        if (seen[neighbor] || data[neighbor * 4] < 80) return;
        seen[neighbor] = 1;
        queue[tail++] = neighbor;
      };
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }
    if (count >= minArea) {
      components.push({
        x: minX, y: minY, width: maxX - minX + 1,
        height: maxY - minY + 1, area: count,
      });
    }
  }
  return components.sort((a, b) => b.area - a.area);
}

export function boxCenter(box: TrackBox): TrackCenter {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export class SubjectTracker {
  private center: TrackCenter | null = null;
  private lastMeasured: TrackCenter | null = null;
  private velocity: TrackCenter = { x: 0, y: 0 };
  private lastBox: TrackBox | null = null;
  private missed = 0;

  constructor(
    private readonly imageWidth: number,
    private readonly imageHeight: number,
    private readonly subject: TrackedSubject,
  ) {}

  update(candidates: readonly TrackBox[]): SubjectTrack {
    const predicted = this.center && {
      x: this.center.x + this.velocity.x,
      y: this.center.y + this.velocity.y,
    };
    let selected: TrackBox | null = null;
    if (!this.center) {
      selected = candidates[0] ?? null;
    } else {
      const diagonal = Math.hypot(this.imageWidth, this.imageHeight);
      const radius = Math.max(
        this.subject === 'ball' ? 12 : 25,
        diagonal * (this.subject === 'ball' ? 0.18 : 0.22),
        this.lastBox ? Math.max(this.lastBox.width, this.lastBox.height) * 0.8 : 0,
      ) * (1 + Math.min(this.missed, MAX_TRACK_GAP) * 0.4);
      const reference = predicted ?? this.center;
      let best = Number.POSITIVE_INFINITY;
      for (const candidate of candidates) {
        const point = boxCenter(candidate);
        const distance = Math.hypot(point.x - reference.x, point.y - reference.y);
        if (distance > radius) continue;
        const sizePenalty = this.lastBox
          ? Math.abs(Math.log((candidate.area + 1) / (this.lastBox.area + 1))) *
            (this.subject === 'ball' ? 8 : 14) : 0;
        const score = distance + sizePenalty;
        if (score < best) {
          best = score;
          selected = candidate;
        }
      }
    }

    if (selected) {
      const observed = boxCenter(selected);
      const gaps = this.missed + 1;
      if (this.lastMeasured) {
        const dx = (observed.x - this.lastMeasured.x) / gaps;
        const dy = (observed.y - this.lastMeasured.y) / gaps;
        this.velocity = {
          x: this.velocity.x * 0.45 + dx * 0.55,
          y: this.velocity.y * 0.45 + dy * 0.55,
        };
      }
      const alpha = this.subject === 'ball' ? 0.65 : 0.45;
      this.center = this.center
        ? {
          x: this.center.x * (1 - alpha) + observed.x * alpha,
          y: this.center.y * (1 - alpha) + observed.y * alpha,
        } : observed;
      this.lastMeasured = observed;
      this.lastBox = selected;
      this.missed = 0;
      return {
        status: 'detected', center: { ...this.center },
        detectedCenter: observed, box: selected, missedFrames: 0,
      };
    }

    this.missed++;
    if (this.center && this.missed <= MAX_TRACK_GAP) {
      this.center = {
        x: Math.max(0, Math.min(this.imageWidth, this.center.x + this.velocity.x)),
        y: Math.max(0, Math.min(this.imageHeight, this.center.y + this.velocity.y)),
      };
      return {
        status: 'predicted', center: { ...this.center },
        detectedCenter: null, box: null, missedFrames: this.missed,
      };
    }

    // Break the association after a longer gap. Reacquisition can then
    // pick the most prominent component rather than locking onto old motion.
    this.center = null;
    this.lastMeasured = null;
    this.lastBox = null;
    this.velocity = { x: 0, y: 0 };
    return {
      status: 'missing', center: null, detectedCenter: null,
      box: null, missedFrames: this.missed,
    };
  }
}

export function trackMasks(
  frames: readonly {
    player: HTMLCanvasElement;
    ball: HTMLCanvasElement | null;
  }[],
): FrameTracks[] {
  if (!frames.length) return [];
  const width = frames[0].player.width;
  const height = frames[0].player.height;
  const trackers = {
    player: new SubjectTracker(width, height, 'player'),
    ball: new SubjectTracker(width, height, 'ball'),
  };
  return frames.map((frame) => {
    if (frame.player.width !== width || frame.player.height !== height ||
        (frame.ball && (frame.ball.width !== width || frame.ball.height !== height))) {
      throw new Error('Tracked frame masks must have the same dimensions.');
    }
    const components = (canvas: HTMLCanvasElement | null, minimum: number) => {
      if (!canvas) return [];
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not inspect subject tracking mask.');
      return findMaskComponents(
        ctx.getImageData(0, 0, width, height).data, width, height, minimum,
      );
    };
    return {
      player: trackers.player.update(components(frame.player, 12)),
      ball: trackers.ball.update(components(frame.ball, 2)),
    };
  });
}

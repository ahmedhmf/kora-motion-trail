import type { FrameTracks, SubjectTrack, TrackCenter } from './subject-tracking';

export interface TrackingOverlayFrame {
  tracking?: FrameTracks;
}

/** Editor-only diagnostic overlay. Not drawn in exported videos. */
export function drawTrackingOverlay(
  ctx: CanvasRenderingContext2D,
  frames: readonly TrackingOverlayFrame[],
  index: number,
  width: number,
  height: number,
): void {
  const current = frames[index]?.tracking;
  if (!current) return;
  const subjects = [
    { key: 'player' as const, color: '#22d3ee', label: 'PLAYER' },
    { key: 'ball' as const, color: '#facc15', label: 'BALL' },
  ];
  ctx.save();
  ctx.lineWidth = Math.max(2, width / 320);
  ctx.font = `${Math.max(11, Math.round(width / 35))}px sans-serif`;
  for (const subject of subjects) {
    const track = current[subject.key];
    const points: TrackCenter[] = [];
    for (let i = Math.max(0, index - 12); i <= index; i++) {
      const previous = frames[i]?.tracking?.[subject.key];
      if (previous?.center && previous.status !== 'missing') points.push(previous.center);
    }
    if (points.length > 1) {
      ctx.strokeStyle = subject.color;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    if (!track.center) continue;
    ctx.strokeStyle = subject.color;
    ctx.fillStyle = subject.color;
    ctx.setLineDash(track.status === 'predicted' ? [5, 4] : []);
    if (track.status === 'detected' && track.box) {
      const box = track.box;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
    ctx.beginPath();
    ctx.arc(track.center.x, track.center.y, Math.max(5, width / 90), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = `${subject.label} · ${track.status}`;
    const labelWidth = ctx.measureText(label).width + 12;
    const left = Math.max(0, Math.min(width - labelWidth, track.center.x + 8));
    const top = Math.max(0, Math.min(height - 22, track.center.y - 28));
    ctx.fillStyle = 'rgba(9, 12, 20, 0.85)';
    ctx.fillRect(left, top, labelWidth, 21);
    ctx.fillStyle = subject.color;
    ctx.fillText(label, left + 6, top + 15);
  }
  ctx.restore();
}

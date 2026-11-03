import {
  ExportAspectRatio,
  ExportFit,
  VideoResolution,
} from '../models/video-export-settings.model';

export interface ExportDimensions {
  width: number;
  height: number;
}

// Presets use standard output frames. They may upscale small source images.
export function getExportDimensions(
  sourceWidth: number,
  sourceHeight: number,
  resolution: VideoResolution,
  aspectRatio: ExportAspectRatio,
): ExportDimensions {
  const shortEdge = resolution === '720p' ? 720 : resolution === '1080p' ? 1080 : 2160;

  if (aspectRatio === '9:16') {
    return { width: shortEdge, height: Math.round(shortEdge * 16 / 9) };
  }
  if (aspectRatio === '4:5') {
    return { width: shortEdge, height: Math.round(shortEdge * 5 / 4) };
  }
  if (aspectRatio === '1:1') {
    return { width: shortEdge, height: shortEdge };
  }
  if (aspectRatio === '16:9') {
    return { width: Math.round(shortEdge * 16 / 9), height: shortEdge };
  }

  // Preserve the source aspect ratio and do not upscale original-size exports.
  const maxDimension = resolution === '720p' ? 1280 : resolution === '1080p' ? 1920 : 3840;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));

  return {
    width: Math.max(2, Math.round(sourceWidth * scale / 2) * 2),
    height: Math.max(2, Math.round(sourceHeight * scale / 2) * 2),
  };
}

export interface ExportFraming {
  fit: ExportFit;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface ExportGeometry {
  x: number;
  y: number;
  drawnWidth: number;
  drawnHeight: number;
  // Half of available translation along each axis, in output pixels.
  travelX: number;
  travelY: number;
}

export function getExportGeometry(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  framing: ExportFraming,
): ExportGeometry {
  const baseScale = framing.fit === 'cover'
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  const zoom = Math.max(100, Math.min(300, framing.zoom)) / 100;
  const drawnWidth = sourceWidth * baseScale * zoom;
  const drawnHeight = sourceHeight * baseScale * zoom;
  const travelX = Math.abs(width - drawnWidth) / 2;
  const travelY = Math.abs(height - drawnHeight) / 2;
  const offsetX = Math.max(-100, Math.min(100, framing.offsetX)) / 100;
  const offsetY = Math.max(-100, Math.min(100, framing.offsetY)) / 100;

  return {
    x: (width - drawnWidth) / 2 + travelX * offsetX,
    y: (height - drawnHeight) / 2 + travelY * offsetY,
    drawnWidth,
    drawnHeight,
    travelX,
    travelY,
  };
}

export function drawExportFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  framing: ExportFraming,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const geometry = getExportGeometry(sourceWidth, sourceHeight, width, height, framing);
  ctx.drawImage(
    source,
    geometry.x,
    geometry.y,
    geometry.drawnWidth,
    geometry.drawnHeight,
  );
}

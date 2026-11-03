import { describe, expect, it } from 'vitest';
import { getExportDimensions, getExportGeometry } from './export-layout';

describe('social export dimensions', () => {
  it('renders portrait reels at 1080 × 1920', () => {
    expect(getExportDimensions(4000, 3000, '1080p', '9:16')).toEqual({
      width: 1080, height: 1920,
    });
  });

  it('renders square posts at 1080 × 1080', () => {
    expect(getExportDimensions(4000, 3000, '1080p', '1:1')).toEqual({
      width: 1080, height: 1080,
    });
  });

  it('renders Instagram portrait at 1080 × 1350', () => {
    expect(getExportDimensions(4000, 3000, '1080p', '4:5')).toEqual({
      width: 1080, height: 1350,
    });
  });

  it('renders landscape video at 1920 × 1080', () => {
    expect(getExportDimensions(4000, 3000, '1080p', '16:9')).toEqual({
      width: 1920, height: 1080,
    });
  });

  it('preserves original aspect ratio without upscaling', () => {
    expect(getExportDimensions(800, 600, '4k', 'original')).toEqual({
      width: 800, height: 600,
    });
  });

  it('fits large original photos within selected resolution', () => {
    expect(getExportDimensions(4000, 2000, '1080p', 'original')).toEqual({
      width: 1920, height: 960,
    });
  });
});

describe('shared export crop geometry', () => {
  const portrait = { fit: 'cover' as const, zoom: 100, offsetX: 0, offsetY: 0 };

  it('center-crops a landscape source to portrait', () => {
    const geometry = getExportGeometry(1920, 1080, 1080, 1920, portrait);
    expect(geometry.drawnHeight).toBeCloseTo(1920);
    expect(geometry.x).toBeCloseTo((1080 - geometry.drawnWidth) / 2);
  });

  it('positions the source within the available crop range', () => {
    const left = getExportGeometry(1920, 1080, 1080, 1920, { ...portrait, offsetX: -100 });
    const right = getExportGeometry(1920, 1080, 1080, 1920, { ...portrait, offsetX: 100 });
    expect(left.x).toBeCloseTo(1080 - left.drawnWidth);
    expect(right.x).toBeCloseTo(0);
    expect(left.y).toBeCloseTo(right.y);
  });

  it('keeps the source centered when position is reset', () => {
    const geometry = getExportGeometry(1920, 1080, 1080, 1920, { ...portrait, zoom: 150 });
    expect(geometry.x).toBeCloseTo((1080 - geometry.drawnWidth) / 2);
    expect(geometry.y).toBeCloseTo((1920 - geometry.drawnHeight) / 2);
  });

  it('scales the subject proportionally when zooming', () => {
    const normal = getExportGeometry(1920, 1080, 1080, 1920, portrait);
    const zoomed = getExportGeometry(1920, 1080, 1080, 1920, { ...portrait, zoom: 200 });
    expect(zoomed.drawnWidth).toBeCloseTo(normal.drawnWidth * 2);
    expect(zoomed.drawnHeight).toBeCloseTo(normal.drawnHeight * 2);
  });

  it('fits the entire source in contain mode', () => {
    const geometry = getExportGeometry(1920, 1080, 1080, 1920, {
      fit: 'contain', zoom: 100, offsetX: 0, offsetY: 0,
    });
    expect(geometry.drawnWidth).toBeCloseTo(1080);
    expect(geometry.drawnHeight).toBeCloseTo(607.5);
    expect(geometry.y).toBeGreaterThan(0);
  });
});

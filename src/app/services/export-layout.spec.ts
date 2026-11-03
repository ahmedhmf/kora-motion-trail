import { describe, expect, it } from 'vitest';
import { getExportDimensions } from './export-layout';

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

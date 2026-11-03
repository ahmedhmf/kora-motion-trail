
import { Injectable } from '@angular/core';
import { VideoExportSettings } from '../models/video-export-settings.model';
import { drawExportFrame, getExportDimensions } from './export-layout';

@Injectable({
  providedIn: 'root'
})
export class ArtworkExportService {

  async exportPng(
    canvas: HTMLCanvasElement,
    filename: string,
    settings?: Pick<VideoExportSettings, 'resolution' | 'aspectRatio' | 'fit'>,
  ): Promise<void> {
    let artwork = canvas;

    if (settings) {
      const { width, height } = getExportDimensions(
        canvas.width,
        canvas.height,
        settings.resolution,
        settings.aspectRatio,
      );
      artwork = document.createElement('canvas');
      artwork.width = width;
      artwork.height = height;
      const ctx = artwork.getContext('2d');
      if (!ctx) throw new Error('Could not create export canvas.');
      drawExportFrame(ctx, canvas, canvas.width, canvas.height, width, height, settings.fit);
    }


    const blob = await new Promise<Blob>(
      (resolve, reject) => {
        artwork.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(
                new Error('Failed to create PNG image.')
              );
            }
          },
          'image/png'
        );
      }
    );

    const url = URL.createObjectURL(blob);

    try {
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      // Release the temporary object URL after
      // the browser has initiated the download.
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    }
  }
}

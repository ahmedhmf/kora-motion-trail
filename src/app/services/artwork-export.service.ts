
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ArtworkExportService {

  async exportPng(
    canvas: HTMLCanvasElement,
    filename: string
  ): Promise<void> {

    const blob = await new Promise<Blob>(
      (resolve, reject) => {
        canvas.toBlob(
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

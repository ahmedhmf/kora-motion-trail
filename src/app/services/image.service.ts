
import { Injectable } from '@angular/core';
import { UploadedImage } from '../models/uploaded-image.model';

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  async loadImage(file: File): Promise<UploadedImage> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Please select a JPG, PNG, or WebP image.');
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(
          new Error('Unable to decode the selected image.')
        );
        image.src = url;
      });

      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error('Invalid image dimensions.');
      }

      return {
        name: file.name,
        width: image.naturalWidth,
        height: image.naturalHeight,
        size: file.size,
        image
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

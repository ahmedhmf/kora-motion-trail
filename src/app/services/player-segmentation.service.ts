import { Injectable } from '@angular/core';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

@Injectable({ providedIn: 'root' })
export class PlayerSegmentationService {
  private segmenterPromise?: Promise<ImageSegmenter>;

  private getSegmenter(): Promise<ImageSegmenter> {
    if (!this.segmenterPromise) {
      this.segmenterPromise = this.initialize().catch((error) => {
        this.segmenterPromise = undefined;
        throw error;
      });
    }

    return this.segmenterPromise;
  }

  private async initialize(): Promise<ImageSegmenter> {
    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');

    return ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  }

  async generateMask(image: HTMLImageElement): Promise<HTMLCanvasElement> {
    const segmenter = await this.getSegmenter();

    // Limit inference resolution for mobile devices.
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));

    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;

    const sourceContext = source.getContext('2d');
    if (!sourceContext) {
      throw new Error('Canvas is unavailable.');
    }

    sourceContext.drawImage(image, 0, 0, width, height);

    const result = segmenter.segment(source);
    console.log('Confidence masks:', result.confidenceMasks?.length);
    console.log('Category mask available:', !!result.categoryMask);
    try {
      const personMask = result.confidenceMasks?.[0];

      if (!personMask) {
        throw new Error('No confidence mask returned. Check the segmentation configuration.');
      }

      const confidence = personMask.getAsFloat32Array();

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = personMask.width;
      maskCanvas.height = personMask.height;

      const ctx = maskCanvas.getContext('2d')!;
      const pixels = ctx.createImageData(maskCanvas.width, maskCanvas.height);

      for (let i = 0; i < confidence.length; i++) {
        // A lower threshold can recover uncertain body parts.
        const probability = confidence[i];
        const alpha = Math.max(0, Math.min(1, (probability - 0.2) / 0.6));

        const value = Math.round(alpha * 255);
        const index = i * 4;

        pixels.data[index] = value;
        pixels.data[index + 1] = value;
        pixels.data[index + 2] = value;
        pixels.data[index + 3] = 255;
      }

      ctx.putImageData(pixels, 0, 0);

      // Keep your existing code that scales this mask
      // to the original photograph's dimensions.
      return maskCanvas;
    } finally {
      result.close();
    }
  }
}

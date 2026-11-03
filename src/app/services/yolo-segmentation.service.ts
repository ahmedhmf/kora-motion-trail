
import { Injectable } from '@angular/core';
import YOLO, { type Results } from '@ultralytics/yolo';

@Injectable({
  providedIn: 'root'
})
export class YoloSegmentationService {
  private modelPromise: Promise<YOLO> | null = null;

  private loadModel(): Promise<YOLO> {
    if (!this.modelPromise) {
      this.modelPromise = YOLO.load(
        '/models/yolo-seg.onnx',
        { device: 'auto' }
      ).catch(error => {
        this.modelPromise = null;
        throw error;
      });
    }

    return this.modelPromise;
  }

  async generateMask(
    image: HTMLImageElement
  ): Promise<HTMLCanvasElement> {
    const model = await this.loadModel();

    if (model.task !== 'segment') {
      throw new Error(
        `Expected segmentation model, got: ${model.task}`
      );
    }

    // COCO class IDs:
    // 0 = person
    // 32 = sports ball
    const results = await model.predict(image, {
      classes: [0, 32],
      conf: 0.15
    });

    console.log(
      'YOLO detections:',
      results.boxes.map(box => ({
        name: box.name,
        confidence: box.conf
      }))
    );

    return this.createCombinedMask(results, image);
  }

  private createCombinedMask(
    results: Results,
    image: HTMLImageElement
  ): HTMLCanvasElement {
    const width = results.width;
    const height = results.height;

    if (
      width <= 0 ||
      height <= 0 ||
      results.masks.length !== width * height * 4
    ) {
      throw new Error(
        'YOLO returned an invalid segmentation mask.'
      );
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;

    const ctx = maskCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not create mask canvas.');
    }

    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;

      // The alpha channel identifies segmented regions.
      const value =
        results.masks[offset + 3] > 0 ? 255 : 0;

      imageData.data[offset] = value;
      imageData.data[offset + 1] = value;
      imageData.data[offset + 2] = value;
      imageData.data[offset + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    // Match the dimensions of the uploaded photograph.
    const fullMask = document.createElement('canvas');

    fullMask.width = image.naturalWidth;
    fullMask.height = image.naturalHeight;

    const fullCtx = fullMask.getContext('2d');

    if (!fullCtx) {
      throw new Error('Could not create output canvas.');
    }

    fullCtx.imageSmoothingEnabled = true;

    fullCtx.drawImage(
      maskCanvas,
      0,
      0,
      fullMask.width,
      fullMask.height
    );

    return fullMask;
  }
}

import { Injectable } from '@angular/core';
import YOLO, { type Results } from '@ultralytics/yolo';
import { buildClassifiedMaskData, hasMaskForeground } from './segmentation-mask-data';

export interface SubjectSegmentationMasks {
  player: HTMLCanvasElement;
  ball: HTMLCanvasElement | null;
  combined: HTMLCanvasElement;
}

@Injectable({ providedIn: 'root' })
export class YoloSegmentationService {
  private modelPromise: Promise<YOLO> | null = null;

  private loadModel(): Promise<YOLO> {
    if (!this.modelPromise) {
      this.modelPromise = YOLO.load('/models/yolo-seg.onnx', { device: 'auto' })
        .catch((error) => {
          this.modelPromise = null;
          throw error;
        });
    }
    return this.modelPromise;
  }

  /** Keep the old API for callers that only need the union mask. */
  async generateMask(image: HTMLImageElement): Promise<HTMLCanvasElement> {
    return (await this.generateSubjectMasks(image)).combined;
  }

  async generateSubjectMasks(
    image: HTMLImageElement | HTMLCanvasElement,
    allowMissingPlayer = false,
  ): Promise<SubjectSegmentationMasks> {
    const model = await this.loadModel();
    if (model.task !== 'segment') {
      throw new Error(`Expected segmentation model, got: ${model.task}`);
    }

    // @ultralytics/yolo exposes one RGBA mask overlay per prediction, not a
    // per-instance mask array. Run the model for each class separately.
    // COCO: 0 = person, 32 = sports ball.
    const playerResult = await model.predict(image, { classes: [0], conf: 0.15 });
    const playerWidth = playerResult.width;
    const playerHeight = playerResult.height;
    // Snapshot the first class overlay before running inference again: model
    // implementations may reuse their underlying output buffers.
    const playerOverlay = new Uint8Array(this.overlayForClass(playerResult, 0));
    const ballResult = await model.predict(image, { classes: [32], conf: 0.15 });

    if (playerWidth !== ballResult.width || playerHeight !== ballResult.height) {
      throw new Error('YOLO class masks have different image dimensions.');
    }
    const ballOverlay = this.overlayForClass(ballResult, 32);
    const masks = buildClassifiedMaskData(
      playerOverlay, ballOverlay, playerWidth, playerHeight,
    );

    if (!allowMissingPlayer && !hasMaskForeground(masks.player)) {
      throw new Error('No player detected. Try another photo or detect again.');
    }

    return {
      player: this.toFullResolutionMask(masks.player, playerWidth, playerHeight, image),
      ball: hasMaskForeground(masks.ball)
        ? this.toFullResolutionMask(masks.ball, playerWidth, playerHeight, image) : null,
      combined: this.toFullResolutionMask(masks.combined, playerWidth, playerHeight, image),
    };
  }

  private overlayForClass(result: Results, cls: number): Uint8Array {
    const expectedLength = result.width * result.height * 4;
    if (result.width <= 0 || result.height <= 0) {
      throw new Error('YOLO returned invalid image dimensions.');
    }
    // YOLO can return zero mask bytes if there are no detections.
    // Treat the missing ball as an empty class mask, not an error.
    if (!result.boxes.some((box) => box.cls === cls)) {
      return new Uint8Array(expectedLength);
    }
    if (result.masks.length !== expectedLength) {
      throw new Error('YOLO returned an invalid class mask overlay.');
    }
    return result.masks;
  }

  private toFullResolutionMask(
    bytes: Uint8ClampedArray, width: number, height: number,
    image: HTMLImageElement | HTMLCanvasElement,
  ): HTMLCanvasElement {
    const small = document.createElement('canvas');
    small.width = width;
    small.height = height;
    const ctx = small.getContext('2d');
    if (!ctx) throw new Error('Could not create class mask canvas.');
    const pixels = ctx.createImageData(width, height);
    pixels.data.set(bytes);
    ctx.putImageData(pixels, 0, 0);

    const full = document.createElement('canvas');
    full.width = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
    full.height = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
    const fullCtx = full.getContext('2d');
    if (!fullCtx) throw new Error('Could not resize class mask.');
    fullCtx.imageSmoothingEnabled = false;
    fullCtx.drawImage(small, 0, 0, full.width, full.height);
    return full;
  }
}

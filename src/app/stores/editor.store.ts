import { computed, inject } from '@angular/core';

import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { ImageService } from '../services/image.service';
import { UploadedImage } from '../models/uploaded-image.model';
import { DEFAULT_MOTION_SETTINGS, MotionSettings } from '../models/motion-settings.model';
import { PlayerSegmentationService } from '../services/player-segmentation.service';
import { DEFAULT_MASK_BRUSH, MaskBrushSettings } from '../models/mask-brush.model';
import { YoloSegmentationService } from '../services/yolo-segmentation.service';
import { MotionTrailsService } from '../services/motion-trails.service';

type EditorState = {
  uploadedImage: UploadedImage | null;
  isLoading: boolean;
  isMaskLoading: boolean;
  error: string | null;
  maskError: string | null;
  motionSettings: MotionSettings;
  playerMask: HTMLCanvasElement | null;
  isDetectingPlayer: boolean;
  detectionError: string | null;
  brushSettings: MaskBrushSettings;
  processedImage: HTMLCanvasElement | null;
};

const initialState: EditorState = {
  uploadedImage: null,
  isLoading: false,
  error: null,
  motionSettings: DEFAULT_MOTION_SETTINGS,
  playerMask: null,
  isMaskLoading: false,
  maskError: null,
  isDetectingPlayer: false,
  detectionError: null,
  brushSettings: { ...DEFAULT_MASK_BRUSH },
  processedImage: null,
};

export const EditorStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ uploadedImage }) => ({
    hasImage: computed(() => uploadedImage() !== null),
  })),

  withMethods(
    (
      store,
      imageService = inject(ImageService),
      segmentationService = inject(YoloSegmentationService),
      motionTrailsService = inject(MotionTrailsService),
    ) => ({
      async uploadImage(file: File): Promise<void> {
        patchState(store, {
          isLoading: true,
          error: null,
        });

        try {
          const image = await imageService.loadImage(file);

          motionTrailsService.invalidateSubjectCache();
          patchState(store, {
            uploadedImage: image,
            playerMask: null,
            maskError: null,
            isLoading: false,
            processedImage: null,
          });
        } catch (error) {
          patchState(store, {
            error: error instanceof Error ? error.message : 'Unable to upload image.',
            isLoading: false,
          });
        }
      },
      updateMotionSettings(changes: Partial<MotionSettings>) {
        patchState(store, {
          motionSettings: {
            ...store.motionSettings(),
            ...changes,
          },
        });

        // Automatically regenerate the artwork.
        if (store.uploadedImage() && store.playerMask()) {
          const result = motionTrailsService.render(
            store.uploadedImage()!.image,
            store.playerMask()!,
            store.motionSettings(),
          );

          patchState(store, {
            processedImage: result,
          });
        }
      },

      resetMotionSettings(): void {
        patchState(store, {
          motionSettings: { ...DEFAULT_MOTION_SETTINGS },
        });
      },

      clearImage(): void {
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          uploadedImage: null,
          playerMask: null,
          error: null,
          maskError: null,
          processedImage: null,
        });
      },
      async detectPlayer(): Promise<void> {
        const uploaded = store.uploadedImage();

        if (!uploaded || store.isDetectingPlayer()) {
          return;
        }

        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          isDetectingPlayer: true,
          detectionError: null,
          playerMask: null,
          processedImage: null,
        });

        try {
          const mask = await segmentationService.generateMask(uploaded.image);

          // Avoid applying results to a different uploaded photo.
          if (store.uploadedImage() !== uploaded) {
            return;
          }

          patchState(store, {
            playerMask: mask,
            processedImage: null,
          });
        } catch (error) {
          if (store.uploadedImage() === uploaded) {
            patchState(store, {
              detectionError: error instanceof Error ? error.message : 'Player detection failed.',
            });
          }
        } finally {
          patchState(store, {
            isDetectingPlayer: false,
          });
        }
      },

      clearPlayerMask(): void {
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          playerMask: null,
          maskError: null,
        });
      },
      updateBrushSettings(changes: Partial<MaskBrushSettings>): void {
        patchState(store, {
          brushSettings: {
            ...store.brushSettings(),
            ...changes,
          },
        });
      },

      updatePlayerMask(mask: HTMLCanvasElement): void {
        if (!store.uploadedImage()) return;

        // Masks may be edited in place: a canvas reference alone is not a revision.
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          playerMask: mask,
          processedImage: null,
        });
      },
      applyMotionTrails(): void {
        const uploaded = store.uploadedImage();
        const mask = store.playerMask();

        if (!uploaded || !mask) {
          return;
        }

        try {
          const result = motionTrailsService.render(uploaded.image, mask, store.motionSettings());

          patchState(store, {
            processedImage: result,
          });
        } catch (error) {
          console.error('Motion Trails failed:', error);
        }
      },
    }),
  ),
);

import { computed, inject } from '@angular/core';

import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { ImageService } from '../services/image.service';
import { UploadedImage } from '../models/uploaded-image.model';
import { DEFAULT_MOTION_SETTINGS, MotionSettings } from '../models/motion-settings.model';
import { PlayerSegmentationService } from '../services/player-segmentation.service';
import { DEFAULT_MASK_BRUSH, MaskBrushSettings } from '../models/mask-brush.model';
import { YoloSegmentationService } from '../services/yolo-segmentation.service';
import { MotionTrailsService } from '../services/motion-trails.service';
import { BallSelection, MotionSubject, getBallSelectionAt } from '../models/subject-selection.model';
import { splitSubjectMasks } from '../services/subject-masks';

type EditorState = {
  uploadedImage: UploadedImage | null;
  isLoading: boolean;
  isMaskLoading: boolean;
  error: string | null;
  maskError: string | null;
  motionSettings: MotionSettings;
  ballMotionSettings: MotionSettings;
  activeSubject: MotionSubject;
  ballSelection: BallSelection | null;
  ballMask: HTMLCanvasElement | null;
  playerOnlyMask: HTMLCanvasElement | null;
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
  motionSettings: { ...DEFAULT_MOTION_SETTINGS },
  ballMotionSettings: { ...DEFAULT_MOTION_SETTINGS },
  activeSubject: 'player',
  ballSelection: null,
  ballMask: null,
  playerOnlyMask: null,
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

  withComputed(({ uploadedImage, motionSettings, ballMotionSettings, activeSubject }) => ({
    hasImage: computed(() => uploadedImage() !== null),
    currentMotionSettings: computed(() =>
      activeSubject() === 'ball' ? ballMotionSettings() : motionSettings()),
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
            ballMask: null,
            playerOnlyMask: null,
            ballSelection: null,
            activeSubject: 'player',
            ballMotionSettings: { ...DEFAULT_MOTION_SETTINGS },
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
      updateMotionSettings(changes: Partial<MotionSettings>): void {
        if (store.activeSubject() === 'ball' && store.ballMask()) {
          patchState(store, {
            ballMotionSettings: { ...store.ballMotionSettings(), ...changes },
          });
        } else {
          patchState(store, {
            motionSettings: { ...store.motionSettings(), ...changes },
          });
        }
        this.applyMotionTrails();
      },

      resetMotionSettings(): void {
        if (store.activeSubject() === 'ball' && store.ballMask()) {
          patchState(store, { ballMotionSettings: { ...DEFAULT_MOTION_SETTINGS } });
        } else {
          patchState(store, { motionSettings: { ...DEFAULT_MOTION_SETTINGS } });
        }
        this.applyMotionTrails();
      },

      setActiveSubject(subject: MotionSubject): void {
        patchState(store, {
          activeSubject: subject === 'ball' && store.ballMask() ? 'ball' : 'player',
        });
      },

      setBallSelection(x: number, y: number, radius?: number): void {
        const uploaded = store.uploadedImage();
        const mask = store.playerMask();
        if (!uploaded || !mask) return;
        const selection = getBallSelectionAt(
          x, y, radius ?? Math.max(6, Math.round(Math.min(uploaded.width, uploaded.height) * 0.025)),
          mask.width, mask.height,
        );
        const separated = splitSubjectMasks(mask, selection);
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          ballSelection: selection,
          ballMask: separated.ball,
          playerOnlyMask: separated.player,
          activeSubject: 'ball',
        });
        this.applyMotionTrails();
      },

      updateBallRadius(radius: number): void {
        const selection = store.ballSelection();
        if (selection) this.setBallSelection(selection.x, selection.y, radius);
      },

      clearBallSelection(): void {
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          ballSelection: null,
          ballMask: null,
          playerOnlyMask: null,
          activeSubject: 'player',
        });
        this.applyMotionTrails();
      },

      clearImage(): void {
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          uploadedImage: null,
          playerMask: null,
          ballMask: null,
          playerOnlyMask: null,
          ballSelection: null,
          activeSubject: 'player',
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
          ballMask: null,
          playerOnlyMask: null,
          ballSelection: null,
          activeSubject: 'player',
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
            ballMask: null,
            playerOnlyMask: null,
            ballSelection: null,
            activeSubject: 'player',
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
          ballMask: null,
          playerOnlyMask: null,
          ballSelection: null,
          activeSubject: 'player',
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
          ballMask: null,
          playerOnlyMask: null,
          ballSelection: null,
          activeSubject: 'player',
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
          const result = motionTrailsService.render(
            uploaded.image,
            store.playerOnlyMask() ?? mask,
            store.motionSettings(),
            store.ballMask(),
            store.ballMotionSettings(),
          );

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

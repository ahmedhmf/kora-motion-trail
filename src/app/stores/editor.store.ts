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
import {
  splitSubjectMasks, combineSubjectMasks, cloneBallMask,
  paintBallMaskStroke, rebuildMasksFromBall, scaleDetectedBallMask,
  excludeBallFromPlayer, type BallBrushMode,
} from '../services/subject-masks';

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
  refiningBallMask: boolean;
  ballMaskDraft: HTMLCanvasElement | null;
  ballMaskRevision: number;
  ballBrushMode: BallBrushMode;
  ballBrushSize: number;
  showBallMaskOverlay: boolean;
  playerOnlyMask: HTMLCanvasElement | null;
  detectedPlayerMask: HTMLCanvasElement | null;
  detectedBallMask: HTMLCanvasElement | null;
  ballMaskScale: number;
  ballMaskEdited: boolean;
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
  refiningBallMask: false,
  ballMaskDraft: null,
  ballMaskRevision: 0,
  ballBrushMode: 'add',
  ballBrushSize: 24,
  showBallMaskOverlay: true,
  playerOnlyMask: null,
  detectedPlayerMask: null,
  detectedBallMask: null,
  ballMaskScale: 100,
  ballMaskEdited: false,
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
            refiningBallMask: false,
            ballMaskDraft: null,
            ballMaskRevision: 0,
            playerOnlyMask: null,
            detectedPlayerMask: null,
            detectedBallMask: null,
            ballMaskScale: 100,
            ballMaskEdited: false,
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

      startBallMaskRefinement(): void {
        const current = store.ballMask();
        if (!current || store.refiningBallMask()) return;
        patchState(store, {
          refiningBallMask: true,
          ballMaskDraft: cloneBallMask(current),
          ballMaskRevision: 0,
          showBallMaskOverlay: true,
          activeSubject: 'ball',
        });
      },

      cancelBallMaskRefinement(): void {
        patchState(store, {
          refiningBallMask: false,
          ballMaskDraft: null,
          ballMaskRevision: 0,
        });
      },

      applyBallMaskRefinement(): void {
        const draft = store.ballMaskDraft();
        if (!store.refiningBallMask() || !draft) return;
        const originalPlayer = store.detectedPlayerMask()
          ?? store.playerOnlyMask() ?? store.playerMask();
        if (!originalPlayer) return;
        const result = rebuildMasksFromBall(originalPlayer, draft);
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          ballMask: result.ball,
          ballMaskEdited: true,
          playerOnlyMask: result.player,
          playerMask: result.combined,
          refiningBallMask: false,
          ballMaskDraft: null,
          ballMaskRevision: 0,
          activeSubject: 'ball',
        });
        this.applyMotionTrails();
      },

      setBallBrushMode(mode: BallBrushMode): void {
        if (mode === 'add' || mode === 'erase') patchState(store, { ballBrushMode: mode });
      },

      setBallBrushSize(size: number): void {
        if (Number.isFinite(size)) {
          patchState(store, { ballBrushSize: Math.max(4, Math.min(100, Math.round(size))) });
        }
      },

      setBallMaskOverlayVisible(visible: boolean): void {
        patchState(store, { showBallMaskOverlay: visible });
      },

      paintBallMask(
        from: { x: number; y: number },
        to: { x: number; y: number },
      ): void {
        const draft = store.ballMaskDraft();
        if (!store.refiningBallMask() || !draft) return;
        paintBallMaskStroke(draft, from, to, store.ballBrushSize(), store.ballBrushMode());
        // A revision lets the canvas repaint without cloning a full-resolution
        // image after every pointer movement. The draft stays isolated.
        patchState(store, { ballMaskRevision: store.ballMaskRevision() + 1 });
      },

      setBallMaskScale(value: number): void {
        // A hand-refined mask must never be discarded by the size slider.
        const detectedBall = store.detectedBallMask();
        const detectedPlayer = store.detectedPlayerMask();
        if (!detectedBall || !detectedPlayer || store.ballMaskEdited() ||
            store.refiningBallMask() || store.ballSelection() ||
            !Number.isFinite(value)) return;

        const ballMaskScale = Math.max(50, Math.min(250, Math.round(value / 5) * 5));
        if (ballMaskScale === store.ballMaskScale()) return;

        const ballMask = scaleDetectedBallMask(detectedBall, ballMaskScale);
        const playerMask = excludeBallFromPlayer(detectedPlayer, ballMask);
        const combinedMask = combineSubjectMasks(playerMask, ballMask);
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          ballMaskScale,
          ballMask,
          playerOnlyMask: playerMask,
          playerMask: combinedMask,
        });
        this.applyMotionTrails();
      },

      setBallSelection(x: number, y: number, radius?: number): void {
        const uploaded = store.uploadedImage();
        const basePlayer = store.detectedPlayerMask() ?? store.playerOnlyMask() ?? store.playerMask();
        if (!uploaded || !basePlayer) return;

        const selection = getBallSelectionAt(
          x, y, radius ?? Math.max(6, Math.round(Math.min(uploaded.width, uploaded.height) * 0.025)),
          basePlayer.width, basePlayer.height,
        );
        const separated = splitSubjectMasks(basePlayer, selection);
        const combined = combineSubjectMasks(separated.player, separated.ball);
        const hadBall = !!store.ballMask();
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          ballSelection: selection,
          ballMaskEdited: false,
          ballMask: separated.ball,
          playerOnlyMask: separated.player,
          playerMask: combined,
          ballMotionSettings: hadBall
            ? store.ballMotionSettings()
            : { ...store.motionSettings() },
          activeSubject: 'ball',
        });
        this.applyMotionTrails();
      },

      updateBallRadius(radius: number): void {
        const selection = store.ballSelection();
        if (selection) this.setBallSelection(selection.x, selection.y, radius);
      },

      clearBallSelection(): void {
        const player = store.detectedPlayerMask();
        const ball = store.detectedBallMask();
        const originalBall = ball && player && store.ballMaskScale() !== 100
          ? scaleDetectedBallMask(ball, store.ballMaskScale())
          : ball;
        const finalPlayer = player && originalBall
          ? excludeBallFromPlayer(player, originalBall)
          : player;
        const combined = finalPlayer && originalBall
          ? combineSubjectMasks(finalPlayer, originalBall) : finalPlayer;
        motionTrailsService.invalidateSubjectCache();
        patchState(store, {
          ballSelection: null,
          playerMask: combined ?? store.playerMask(),
          ballMask: originalBall,
          ballMaskEdited: false,
          playerOnlyMask: finalPlayer ?? store.playerMask(),
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
          refiningBallMask: false,
          ballMaskDraft: null,
          ballMaskRevision: 0,
          playerOnlyMask: null,
          detectedPlayerMask: null,
          detectedBallMask: null,
          ballMaskScale: 100,
          ballMaskEdited: false,
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
          refiningBallMask: false,
          ballMaskDraft: null,
          ballMaskRevision: 0,
          playerOnlyMask: null,
          detectedPlayerMask: null,
          detectedBallMask: null,
          ballMaskScale: 100,
          ballMaskEdited: false,
          ballSelection: null,
          activeSubject: 'player',
          processedImage: null,
        });

        try {
          const masks = await segmentationService.generateSubjectMasks(uploaded.image);

          // Avoid applying results to a different uploaded photo.
          if (store.uploadedImage() !== uploaded) {
            return;
          }

          patchState(store, {
            playerMask: masks.combined,
            ballMask: masks.ball,
            playerOnlyMask: masks.player,
            detectedPlayerMask: masks.player,
            detectedBallMask: masks.ball,
            ballMaskScale: 100,
            ballMaskEdited: false,
            ballMotionSettings: { ...store.motionSettings() },
            ballSelection: null,
            activeSubject: 'player',
            processedImage: null,
          });
          this.applyMotionTrails();
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
          refiningBallMask: false,
          ballMaskDraft: null,
          ballMaskRevision: 0,
          playerOnlyMask: null,
          detectedPlayerMask: null,
          detectedBallMask: null,
          ballMaskScale: 100,
          ballMaskEdited: false,
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
          refiningBallMask: false,
          ballMaskDraft: null,
          ballMaskRevision: 0,
          playerOnlyMask: null,
          detectedPlayerMask: null,
          detectedBallMask: null,
          ballMaskScale: 100,
          ballMaskEdited: false,
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

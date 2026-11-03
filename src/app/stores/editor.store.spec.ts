import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { EditorStore } from './editor.store';
import { ImageService } from '../services/image.service';
import { YoloSegmentationService } from '../services/yolo-segmentation.service';
import { MotionTrailsService } from '../services/motion-trails.service';

describe('independent player and ball motion settings', () => {
  it('does not shrink or replace either mask when selecting or editing ball motion', async () => {
    const ball = document.createElement('canvas');
    const player = document.createElement('canvas');
    const combined = document.createElement('canvas');
    ball.width = player.width = combined.width = 100;
    ball.height = player.height = combined.height = 100;
    const image = document.createElement('img');
    const uploaded = { image, name: 'football.png', size: 1, width: 100, height: 100 };
    const render = vi.fn(() => document.createElement('canvas'));

    TestBed.configureTestingModule({
      providers: [
        { provide: ImageService, useValue: { loadImage: vi.fn().mockResolvedValue(uploaded) } },
        { provide: YoloSegmentationService, useValue: {
          generateSubjectMasks: vi.fn().mockResolvedValue({ player, ball, combined }),
        } },
        { provide: MotionTrailsService, useValue: {
          invalidateSubjectCache: vi.fn(),
          render,
        } },
      ],
    });
    const store = TestBed.inject(EditorStore);
    await store.uploadImage(new File([''], 'football.png', { type: 'image/png' }));
    await store.detectPlayer();

    const beforeBall = store.ballMask();
    const beforePlayer = store.playerOnlyMask();
    const beforeCombined = store.playerMask();
    expect(beforeBall).toBe(ball);

    store.setActiveSubject('ball');
    store.updateMotionSettings({ directionAngle: 45, echoScale: 130 });

    expect(store.ballMask()).toBe(beforeBall);
    expect(store.playerOnlyMask()).toBe(beforePlayer);
    expect(store.playerMask()).toBe(beforeCombined);
    expect(store.ballMotionSettings().directionAngle).toBe(45);
    expect(store.ballMotionSettings().echoScale).toBe(130);
    expect(store.motionSettings().directionAngle).toBe(180);
    expect(render).toHaveBeenCalled();

    store.setActiveSubject('player');
    expect(store.ballMask()).toBe(beforeBall);
    expect(store.playerOnlyMask()).toBe(beforePlayer);
    expect(store.playerMask()).toBe(beforeCombined);
  });
});

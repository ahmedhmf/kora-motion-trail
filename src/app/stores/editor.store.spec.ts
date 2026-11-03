import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { describe, expect, it } from 'vitest';
import { EditorStore } from './editor.store';

describe('independent motion subject selection', () => {
  it('never resizes or replaces the ball or player masks when switching subjects', () => {
    const store = TestBed.inject(EditorStore);
    const ball = document.createElement('canvas');
    const player = document.createElement('canvas');
    const combined = document.createElement('canvas');
    ball.width = player.width = combined.width = 100;
    ball.height = player.height = combined.height = 100;
    patchState(store, { ballMask: ball, playerOnlyMask: player, playerMask: combined });

    const originalBallSettings = store.ballMotionSettings();
    store.setActiveSubject('ball');
    expect(store.activeSubject()).toBe('ball');
    expect(store.ballMask()).toBe(ball);
    expect(store.playerOnlyMask()).toBe(player);
    expect(store.playerMask()).toBe(combined);

    store.updateMotionSettings({ directionAngle: 45, echoScale: 130 });
    expect(store.ballMask()).toBe(ball);
    expect(store.ballMotionSettings().directionAngle).toBe(45);
    expect(store.ballMotionSettings().echoScale).toBe(130);
    expect(store.motionSettings().directionAngle).toBe(180);

    store.setActiveSubject('player');
    expect(store.ballMask()).toBe(ball);
    expect(store.playerOnlyMask()).toBe(player);
    expect(store.playerMask()).toBe(combined);
    expect(store.ballMotionSettings()).not.toBe(originalBallSettings);
  });
});

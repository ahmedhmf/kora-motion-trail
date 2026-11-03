
export type AnimationStyle =
  | 'reveal'
  | 'pulse'
  | 'loop';

export type VideoFormat = 'webm' | 'mp4';

export type VideoResolution =
  | '720p'
  | '1080p'
  | '4k';

export type VideoFps = 24 | 30 | 60;

export interface VideoExportSettings {
  animationStyle: AnimationStyle;

  durationSeconds: number;

  fps: VideoFps;

  resolution: VideoResolution;

  format: VideoFormat;

  intensity: number;

  loop: boolean;
}

export const DEFAULT_VIDEO_EXPORT_SETTINGS:
  VideoExportSettings = {

  animationStyle: 'reveal',

  durationSeconds: 5,

  fps: 30,

  resolution: '1080p',

  format: 'webm',

  intensity: 80,

  loop: true
};

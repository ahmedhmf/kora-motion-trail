export type AnimationStyle = 'reveal' | 'pulse' | 'loop';
export type VideoFormat = 'webm' | 'mp4';
export type VideoResolution = '720p' | '1080p' | '4k';
export type VideoFps = 24 | 30 | 60;

// 'original' keeps the uploaded image's aspect ratio.
export type ExportAspectRatio = 'original' | '9:16' | '4:5' | '1:1' | '16:9';
export type ExportFit = 'contain' | 'cover';

export interface VideoExportSettings {
  animationStyle: AnimationStyle;
  durationSeconds: number;
  fps: VideoFps;
  resolution: VideoResolution;
  format: VideoFormat;
  intensity: number;
  loop: boolean;
  aspectRatio: ExportAspectRatio;
  fit: ExportFit;
}

export const DEFAULT_VIDEO_EXPORT_SETTINGS: VideoExportSettings = {
  animationStyle: 'reveal',
  durationSeconds: 5,
  fps: 30,
  resolution: '1080p',
  format: 'webm',
  intensity: 80,
  loop: true,
  aspectRatio: 'original',
  fit: 'contain',
};

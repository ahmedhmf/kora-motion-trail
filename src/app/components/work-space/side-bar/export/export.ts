import { Component, inject, input, output, signal } from '@angular/core';
import { EditorStore } from '../../../../stores/editor.store';
import { CollapsibleSection } from '../../../../ui-components/collapsible-section/collapsible-section';
import { ArtworkExportService } from '../../../../services/artwork-export.service';
import {
  ExportAspectRatio,
  ExportFit,
  VideoExportSettings,
} from '../../../../models/video-export-settings.model';
import { getExportDimensions } from '../../../../services/export-layout';
import { VideoExportService } from '../../../../services/video-export.service';

@Component({
  imports: [CollapsibleSection],
  selector: 'app-export',
  styleUrl: './export.css',
  templateUrl: './export.html',
})
export class Export {
  readonly editorStore = inject(EditorStore);
  private readonly artworkExportService = inject(ArtworkExportService);
  private readonly videoExportService = inject(VideoExportService);

  readonly videoSettings = input.required<VideoExportSettings>();
  readonly updateVideoSettings = output<VideoExportSettings>();
  readonly stopAnimation = output<void>();

  readonly isExporting = signal(false);
  readonly exportProgress = signal(0);
  readonly exportError = signal<string | null>(null);
  readonly artworkError = signal<string | null>(null);

  exportDimensionsLabel(): string {
    const image = this.editorStore.uploadedImage();
    if (!image) return 'Upload an image to view dimensions';
    const settings = this.videoSettings();
    const { width, height } = getExportDimensions(
      image.width, image.height, settings.resolution, settings.aspectRatio,
    );
    return `${width} × ${height} px`;
  }

  updateExportAspectRatio(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!['original', '9:16', '4:5', '1:1', '16:9'].includes(value)) return;
    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      aspectRatio: value as ExportAspectRatio,
    });
  }

  updateExportFit(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value !== 'contain' && value !== 'cover') return;
    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      fit: value as ExportFit,
    });
  }

  async exportArtwork(): Promise<void> {
    const artwork = this.editorStore.processedImage();

    if (!artwork) {
      return;
    }

    const uploaded = this.editorStore.uploadedImage();

    const originalName = uploaded?.name ?? 'football-artwork';

    // Remove the original file extension.
    const baseName = originalName.replace(/\.[^/.]+$/, '');

    const filename = `${baseName}-motion-trails-${this.videoSettings().aspectRatio.replace(':', 'x')}.png`;
    this.artworkError.set(null);

    try {
      await this.artworkExportService.exportPng(artwork, filename, this.videoSettings());
    } catch (error) {
      this.artworkError.set(error instanceof Error ? error.message : 'Artwork export failed.');
    }
  }

  updateVideoFormat(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (value !== 'webm' && value !== 'mp4') {
      return;
    }

    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      format: value,
    });
  }

  updateVideoResolution(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (value !== '720p' && value !== '1080p' && value !== '4k') {
      return;
    }

    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      resolution: value,
    });
  }

  updateVideoFps(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);

    if (value !== 24 && value !== 30 && value !== 60) {
      return;
    }

    this.updateVideoSettings.emit({
      ...this.videoSettings(),
      fps: value,
    });
  }

  async exportVideo(): Promise<void> {
    if (this.isExporting()) {
      return;
    }

    const uploaded = this.editorStore.uploadedImage();
    const mask = this.editorStore.playerMask();

    if (!uploaded || !mask) {
      return;
    }

    this.stopAnimation.emit();

    this.isExporting.set(true);
    this.exportProgress.set(0);
    this.exportError.set(null);

    try {
      await this.videoExportService.exportVideo(
        uploaded.image,
        mask,
        this.editorStore.motionSettings(),
        this.videoSettings(),
        (progress) => {
          this.exportProgress.set(Math.round(progress * 100));
        },
      );
    } catch (error) {
      this.exportError.set(error instanceof Error ? error.message : 'Video export failed.');
    } finally {
      this.isExporting.set(false);
    }
  }
}

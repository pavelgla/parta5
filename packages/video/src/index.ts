export type VideoStatus = 'pending' | 'uploading' | 'transcoding' | 'ready' | 'failed';

export interface VideoAdapter {
  requestUpload(input: {
    schoolId: string;
    originalName: string;
    sizeBytes: number;
    uploaderId: string;
  }): Promise<{ videoAssetId: string; uploadUrl: string; key: string; expiresAt: Date }>;

  confirmUploaded(videoAssetId: string): Promise<void>;

  getStatus(videoAssetId: string): Promise<{
    status: VideoStatus;
    hlsPlaylistUrl?: string;
    posterUrl?: string;
    durationSeconds?: number;
  }>;

  delete(videoAssetId: string): Promise<void>;
}

export type { EmbedResult } from './embed/index';
export { parseEmbedUrl } from './embed/index';
export { EMBED_PROVIDERS } from './embed/providers';
export { SelfHostedHLSVideoAdapter } from './self-hosted';

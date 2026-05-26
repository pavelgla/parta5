import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import type { StorageAdapter } from '@parta5/storage';
import type { VideoAdapter, VideoStatus } from './index';

export class SelfHostedHLSVideoAdapter implements VideoAdapter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageAdapter,
    private readonly queue: Queue,
  ) {}

  async requestUpload(input: {
    schoolId: string;
    originalName: string;
    sizeBytes: number;
    uploaderId: string;
  }): Promise<{ videoAssetId: string; uploadUrl: string; key: string; expiresAt: Date }> {
    const id = randomUUID();
    const safe = input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `schools/${input.schoolId}/videos/source/${id}-${safe}`;

    const { url, expiresAt } = await this.storage.presignUpload(key, 'video/mp4', input.sizeBytes);

    await (this.prisma as any).videoAsset.create({
      data: {
        id,
        schoolId: input.schoolId,
        uploaderId: input.uploaderId,
        sourceKey: key,
        status: 'PENDING',
      },
    });

    return { videoAssetId: id, uploadUrl: url, key, expiresAt };
  }

  async confirmUploaded(videoAssetId: string): Promise<void> {
    await (this.prisma as any).videoAsset.update({
      where: { id: videoAssetId },
      data: { status: 'UPLOADING' },
    });
    await this.queue.add('transcode-video', { videoAssetId });
  }

  async getStatus(videoAssetId: string): Promise<{
    status: VideoStatus;
    hlsPlaylistUrl?: string;
    posterUrl?: string;
    durationSeconds?: number;
  }> {
    const asset = await (this.prisma as any).videoAsset.findUnique({
      where: { id: videoAssetId },
    });
    if (!asset) throw new Error(`VideoAsset not found: ${videoAssetId}`);

    const status = asset.status.toLowerCase() as VideoStatus;
    return {
      status,
      hlsPlaylistUrl: asset.hlsMasterKey ? this.storage.publicUrl(asset.hlsMasterKey) : undefined,
      posterUrl: asset.posterKey ? this.storage.publicUrl(asset.posterKey) : undefined,
      durationSeconds: asset.durationSeconds ?? undefined,
    };
  }

  async delete(videoAssetId: string): Promise<void> {
    const asset = await (this.prisma as any).videoAsset.findUnique({
      where: { id: videoAssetId },
    });
    if (!asset) return;

    const keys: string[] = [asset.sourceKey];
    if (asset.hlsMasterKey) keys.push(asset.hlsMasterKey);
    if (asset.posterKey) keys.push(asset.posterKey);

    await Promise.allSettled(keys.map((k) => this.storage.delete(k)));
    await (this.prisma as any).videoAsset.delete({ where: { id: videoAssetId } });
  }
}

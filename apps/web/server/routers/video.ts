import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { createStorageFromEnv } from '@parta5/storage';
import { randomUUID } from 'node:crypto';

const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB

let _queue: Queue | null = null;

function getQueue(): Queue {
  if (!_queue) {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    _queue = new Queue('video-transcode', { connection: redis });
  }
  return _queue;
}

async function requireAsset(schoolId: string, videoAssetId: string) {
  const asset = await withTenant(schoolId, (tx) =>
    tx.videoAsset.findFirst({
      where: { id: videoAssetId, schoolId },
    }),
  );
  if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Video asset not found' });
  return asset;
}

export const videoRouter = router({
  requestUpload: teacherProcedure
    .input(
      z.object({
        originalName: z.string().min(1).max(255),
        sizeBytes: z.number().int().positive().max(MAX_SIZE_BYTES),
        mimeType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const uploaderId = ctx.userId;
      const mimeType = input.mimeType ?? 'video/mp4';

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only mp4, webm, and mov video formats are allowed',
        });
      }

      const videoAssetId = randomUUID();
      const safe = input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `schools/${schoolId}/videos/source/${videoAssetId}-${safe}`;

      const storage = createStorageFromEnv();
      const { url: uploadUrl, expiresAt } = await storage.presignUpload(
        key,
        mimeType,
        input.sizeBytes,
      );

      await withTenant(schoolId, (tx) =>
        tx.videoAsset.create({
          data: { id: videoAssetId, schoolId, uploaderId, sourceKey: key, status: 'PENDING' },
        }),
      );

      return { videoAssetId, uploadUrl, expiresAt };
    }),

  confirmUploaded: teacherProcedure
    .input(z.object({ videoAssetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      await requireAsset(schoolId, input.videoAssetId);

      await withTenant(schoolId, (tx) =>
        tx.videoAsset.update({
          where: { id: input.videoAssetId },
          data: { status: 'UPLOADING' },
        }),
      );

      await getQueue().add(
        'transcode-video',
        { videoAssetId: input.videoAssetId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      return { queued: true };
    }),

  getVideo: tenantProcedure
    .input(z.object({ videoAssetId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const asset = await requireAsset(schoolId, input.videoAssetId);

      const storage = createStorageFromEnv();
      return {
        status: asset.status.toLowerCase(),
        hlsPlaylistUrl: asset.hlsMasterKey ? storage.publicUrl(asset.hlsMasterKey) : null,
        posterUrl: asset.posterKey ? storage.publicUrl(asset.posterKey) : null,
        durationSeconds: asset.durationSeconds ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
        errorMessage: asset.errorMessage ?? null,
      };
    }),

  delete: teacherProcedure
    .input(z.object({ videoAssetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const asset = await requireAsset(schoolId, input.videoAssetId);

      const storage = createStorageFromEnv();
      const keys = [asset.sourceKey, asset.hlsMasterKey, asset.posterKey].filter(
        (k): k is string => !!k,
      );

      await Promise.allSettled(keys.map((k) => storage.delete(k)));
      await withTenant(schoolId, (tx) =>
        tx.videoAsset.delete({ where: { id: input.videoAssetId } }),
      );

      return { deleted: true };
    }),

  listMyVideos: tenantProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;
    const uploaderId = ctx.userId;

    const assets = await withTenant(schoolId, (tx) =>
      tx.videoAsset.findMany({
        where: { schoolId, uploaderId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );

    const storage = createStorageFromEnv();
    return assets.map((a) => ({
      id: a.id,
      status: a.status.toLowerCase(),
      hlsPlaylistUrl: a.hlsMasterKey ? storage.publicUrl(a.hlsMasterKey) : null,
      posterUrl: a.posterKey ? storage.publicUrl(a.posterKey) : null,
      durationSeconds: a.durationSeconds,
      createdAt: a.createdAt,
    }));
  }),
});

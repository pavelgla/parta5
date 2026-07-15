import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { createStorageFromEnv, buildKey } from '@parta5/storage';
import { RequestUploadInput, validateUpload, mimeToAssetType } from '../schemas/file-upload';
import { randomUUID } from 'node:crypto';

function getStorage() {
  return createStorageFromEnv();
}

export const fileRouter = router({
  requestUpload: teacherProcedure.input(RequestUploadInput).mutation(async ({ ctx, input }) => {
    const schoolId = ctx.schoolId;
    const uploaderId = ctx.userId;

    validateUpload(input);

    const uuid = randomUUID();
    const assetType = mimeToAssetType(input.mimeType);
    const key = buildKey(schoolId, assetType, uuid, input.originalName);

    const storage = getStorage();
    const { url: uploadUrl, expiresAt } = await storage.presignUpload(
      key,
      input.mimeType,
      input.sizeBytes,
    );

    const fileAsset = await withTenant(schoolId, (tx) =>
      tx.fileAsset.create({
        data: {
          schoolId,
          uploaderId,
          key,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          status: 'PENDING',
        },
      }),
    );

    return { fileAssetId: fileAsset.id, uploadUrl, key, expiresAt };
  }),

  confirmUpload: teacherProcedure
    .input(z.object({ fileAssetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;

      const asset = await withTenant(schoolId, (tx) =>
        tx.fileAsset.findFirst({
          where: { id: input.fileAssetId, schoolId },
        }),
      );

      if (!asset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'File asset not found' });
      }

      const storage = getStorage();
      const meta = await storage.headObject(asset.key);

      if (!meta) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File not found in storage. Upload may have failed.',
        });
      }

      return withTenant(schoolId, (tx) =>
        tx.fileAsset.update({
          where: { id: asset.id },
          data: { status: 'UPLOADED' },
        }),
      );
    }),

  getAsset: tenantProcedure
    .input(z.object({ fileAssetId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;

      const asset = await withTenant(schoolId, (tx) =>
        tx.fileAsset.findFirst({
          where: { id: input.fileAssetId, schoolId },
          select: {
            id: true,
            key: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            status: true,
          },
        }),
      );

      if (!asset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'File asset not found' });
      }

      return asset;
    }),

  delete: teacherProcedure
    .input(z.object({ fileAssetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;

      const asset = await withTenant(schoolId, (tx) =>
        tx.fileAsset.findFirst({
          where: { id: input.fileAssetId, schoolId },
        }),
      );

      if (!asset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'File asset not found' });
      }

      const storage = getStorage();
      await storage.delete(asset.key);

      return withTenant(schoolId, (tx) =>
        tx.fileAsset.update({
          where: { id: asset.id },
          data: { status: 'DELETED' },
        }),
      );
    }),
});

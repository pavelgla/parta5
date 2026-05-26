import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { createStorageFromEnv, buildKey } from '@parta5/storage';
import { RequestUploadInput, validateUpload, mimeToAssetType } from '../schemas/file-upload';
import { randomUUID } from 'node:crypto';

function getStorage() {
  return createStorageFromEnv();
}

export const fileRouter = router({
  requestUpload: protectedProcedure.input(RequestUploadInput).mutation(async ({ ctx, input }) => {
    const schoolId = ctx.session.user.schoolId!;
    const uploaderId = ctx.session.user.id!;

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

  confirmUpload: protectedProcedure
    .input(z.object({ fileAssetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;

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

  delete: protectedProcedure
    .input(z.object({ fileAssetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;

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

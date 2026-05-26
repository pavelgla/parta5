import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const RequestUploadInput = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export type RequestUploadInput = z.infer<typeof RequestUploadInput>;

export function validateUpload(input: RequestUploadInput): void {
  if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `File too large. Maximum size is 50 MB.`,
    });
  }

  if (!ALLOWED_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `MIME type not allowed: ${input.mimeType}`,
    });
  }
}

export function mimeToAssetType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'images';
  return 'documents';
}

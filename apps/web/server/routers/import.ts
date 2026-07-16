import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { router, teacherProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';

// .mbz backups are gzip or zip archives — browsers report varying MIME types
// for the unrecognized .mbz extension, so all four are accepted.
const ALLOWED_MIME_TYPES = [
  'application/octet-stream',
  'application/gzip',
  'application/x-gzip',
  'application/zip',
];

let _queue: Queue | null = null;

function getQueue(): Queue {
  if (!_queue) {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    _queue = new Queue('course-import', { connection: redis });
  }
  return _queue;
}

export const importRouter = router({
  create: teacherProcedure
    .input(z.object({ fileAssetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;

      const fileAsset = await withTenant(schoolId, (tx) =>
        tx.fileAsset.findFirst({ where: { id: input.fileAssetId, schoolId } }),
      );

      if (!fileAsset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'File asset not found' });
      }

      if (!ALLOWED_MIME_TYPES.includes(fileAsset.mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported file type for course import: ${fileAsset.mimeType}`,
        });
      }

      const courseImport = await withTenant(schoolId, (tx) =>
        tx.courseImport.create({
          data: {
            schoolId,
            fileAssetId: fileAsset.id,
            createdById: ctx.userId,
            status: 'PENDING',
          },
        }),
      );

      // attempts: 1 — a retried job would re-run importCourse and create a
      // duplicate course, so failures must surface instead of auto-retrying.
      await getQueue().add(
        'import-course',
        { courseImportId: courseImport.id, schoolId },
        {
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      return { id: courseImport.id };
    }),

  byId: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;

      const courseImport = await withTenant(schoolId, (tx) =>
        tx.courseImport.findFirst({
          where: { id: input.id, schoolId },
          select: { id: true, status: true, report: true, error: true, courseId: true },
        }),
      );

      if (!courseImport) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Import not found' });
      }

      return courseImport;
    }),

  list: teacherProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;

    return withTenant(schoolId, (tx) =>
      tx.courseImport.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          status: true,
          error: true,
          courseId: true,
          createdAt: true,
          fileAsset: { select: { originalName: true } },
        },
      }),
    );
  }),
});

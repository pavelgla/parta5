import { z } from 'zod';
import { router, tenantProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { logEvent } from '../services/learning-events';

export const progressRouter = router({
  markBlockViewed: tenantProcedure
    .input(z.object({ blockId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      const { blockId } = input;

      return withTenant(schoolId, async (tx) => {
        const block = await tx.contentBlock.findUniqueOrThrow({
          where: { id: blockId },
          select: {
            lessonId: true,
            type: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
        });
        const { lessonId } = block;
        const blockType = block.type;
        const courseId = block.lesson.module.courseId;

        const enrollment = await tx.enrollment.findFirst({
          where: { courseId, userId, role: 'STUDENT' },
        });
        if (!enrollment) return { ok: true };

        await tx.blockView.upsert({
          where: { blockId_userId: { blockId, userId } },
          create: { blockId, lessonId, userId, schoolId, viewedAt: new Date() },
          update: {},
        });

        void logEvent({
          schoolId,
          actorId: userId,
          verb: 'viewed',
          objectType: 'block',
          objectId: blockId,
          result: { lessonId, blockType },
        });

        return { ok: true };
      });
    }),

  markBlockCompleted: tenantProcedure
    .input(z.object({ blockId: z.string().uuid(), watchedSeconds: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      const { blockId } = input;

      return withTenant(schoolId, async (tx) => {
        const block = await tx.contentBlock.findUniqueOrThrow({
          where: { id: blockId },
          select: {
            lessonId: true,
            type: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
        });
        const { lessonId } = block;
        const blockType = block.type;
        const courseId = block.lesson.module.courseId;

        const enrollment = await tx.enrollment.findFirst({
          where: { courseId, userId, role: 'STUDENT' },
        });
        if (!enrollment) return { ok: true, lessonCompleted: false };

        const existing = await tx.blockView.findUnique({
          where: { blockId_userId: { blockId, userId } },
          select: { completedAt: true },
        });
        const wasAlreadyCompleted =
          existing?.completedAt !== null && existing?.completedAt !== undefined;

        await tx.blockView.upsert({
          where: { blockId_userId: { blockId, userId } },
          create: {
            blockId,
            lessonId,
            userId,
            schoolId,
            viewedAt: new Date(),
            completedAt: new Date(),
            watchedSeconds: input.watchedSeconds ?? null,
          },
          update: {
            completedAt: new Date(),
            ...(input.watchedSeconds !== undefined ? { watchedSeconds: input.watchedSeconds } : {}),
          },
        });

        const completedCount = await tx.blockView.count({
          where: { lessonId, userId, completedAt: { not: null } },
        });
        const totalCount = await tx.contentBlock.count({ where: { lessonId } });

        if (!wasAlreadyCompleted) {
          void logEvent({
            schoolId,
            actorId: userId,
            verb: 'completed',
            objectType: 'block',
            objectId: blockId,
            result: { lessonId, blockType, watchedSeconds: input.watchedSeconds ?? null },
          });
        }

        if (completedCount >= totalCount) {
          const existingLessonCompletion = await tx.lessonCompletion.findUnique({
            where: { lessonId_userId: { lessonId, userId } },
            select: { id: true },
          });

          await tx.lessonCompletion.upsert({
            where: { lessonId_userId: { lessonId, userId } },
            create: { lessonId, userId, schoolId },
            update: {},
          });

          if (!existingLessonCompletion) {
            void logEvent({
              schoolId,
              actorId: userId,
              verb: 'completed',
              objectType: 'lesson',
              objectId: lessonId,
              result: { courseId },
            });
          }
        }

        return { ok: true, lessonCompleted: completedCount >= totalCount };
      });
    }),

  courseProgress: tenantProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      const { courseId } = input;

      return withTenant(schoolId, async (tx) => {
        const lessons = await tx.lesson.findMany({
          where: { module: { courseId } },
          select: { id: true, title: true },
        });

        const lessonIds = lessons.map((l) => l.id);

        const blockCounts = await tx.contentBlock.groupBy({
          by: ['lessonId'],
          where: { lessonId: { in: lessonIds } },
          _count: { id: true },
        });

        const viewedCounts = await tx.blockView.groupBy({
          by: ['lessonId'],
          where: { lessonId: { in: lessonIds }, userId },
          _count: { id: true },
        });

        const completedCounts = await tx.blockView.groupBy({
          by: ['lessonId'],
          where: { lessonId: { in: lessonIds }, userId, completedAt: { not: null } },
          _count: { id: true },
        });

        return lessons.map((lesson) => ({
          lessonId: lesson.id,
          title: lesson.title,
          totalBlocks: blockCounts.find((b) => b.lessonId === lesson.id)?._count.id ?? 0,
          viewedBlocks: viewedCounts.find((v) => v.lessonId === lesson.id)?._count.id ?? 0,
          completedBlocks: completedCounts.find((c) => c.lessonId === lesson.id)?._count.id ?? 0,
        }));
      });
    }),
});

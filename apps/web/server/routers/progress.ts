import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';

export const progressRouter = router({
  markBlockViewed: protectedProcedure
    .input(z.object({ blockId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const userId = ctx.session.user.id;
      const { blockId } = input;

      return withTenant(schoolId, async (tx) => {
        const block = await tx.contentBlock.findUniqueOrThrow({
          where: { id: blockId },
          select: {
            lessonId: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
        });
        const { lessonId } = block;
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

        return { ok: true };
      });
    }),

  markBlockCompleted: protectedProcedure
    .input(z.object({ blockId: z.string().uuid(), watchedSeconds: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const userId = ctx.session.user.id;
      const { blockId } = input;

      return withTenant(schoolId, async (tx) => {
        const block = await tx.contentBlock.findUniqueOrThrow({
          where: { id: blockId },
          select: {
            lessonId: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
        });
        const { lessonId } = block;
        const courseId = block.lesson.module.courseId;

        const enrollment = await tx.enrollment.findFirst({
          where: { courseId, userId, role: 'STUDENT' },
        });
        if (!enrollment) return { ok: true, lessonCompleted: false };

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

        if (completedCount >= totalCount) {
          await tx.lessonCompletion.upsert({
            where: { lessonId_userId: { lessonId, userId } },
            create: { lessonId, userId, schoolId },
            update: {},
          });
        }

        return { ok: true, lessonCompleted: completedCount >= totalCount };
      });
    }),

  courseProgress: protectedProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const userId = ctx.session.user.id;
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

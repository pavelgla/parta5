import { z } from 'zod';
import { router, tenantProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';

export const learnRouter = router({
  getCourse: tenantProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      return withTenant(schoolId, async (tx) => {
        const course = await tx.course.findUniqueOrThrow({
          where: { id: input.courseId },
          include: {
            modules: {
              orderBy: { order: 'asc' },
              include: {
                lessons: {
                  orderBy: { order: 'asc' },
                  include: {
                    completions: { where: { userId }, select: { id: true } },
                  },
                },
              },
            },
          },
        });
        return course;
      });
    }),

  getLesson: tenantProcedure
    .input(z.object({ lessonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      return withTenant(schoolId, async (tx) => {
        const lesson = await tx.lesson.findUniqueOrThrow({
          where: { id: input.lessonId },
          include: {
            blocks: {
              orderBy: { order: 'asc' },
              include: {
                blockViews: { where: { userId }, select: { id: true, completedAt: true } },
              },
            },
            completions: { where: { userId }, select: { id: true } },
          },
        });
        return {
          ...lesson,
          isCompleted: lesson.completions.length > 0,
        };
      });
    }),

  completeLesson: tenantProcedure
    .input(z.object({ lessonId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      return withTenant(schoolId, (tx) =>
        tx.lessonCompletion.upsert({
          where: { lessonId_userId: { lessonId: input.lessonId, userId } },
          create: { lessonId: input.lessonId, userId, schoolId },
          update: {},
        }),
      );
    }),
});

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { logEvent } from '../services/learning-events';

export const enrollmentRouter = router({
  enroll: protectedProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const userId = ctx.session.user.id;
      const result = await withTenant(schoolId, (tx) =>
        tx.enrollment.upsert({
          where: { courseId_userId: { userId, courseId: input.courseId } },
          create: { userId, courseId: input.courseId, role: 'STUDENT' },
          update: {},
        }),
      );
      void logEvent({
        schoolId,
        actorId: userId,
        verb: 'enrolled',
        objectType: 'course',
        objectId: input.courseId,
      });
      return result;
    }),

  myEnrollments: protectedProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.session.user.schoolId!;
    const userId = ctx.session.user.id;
    return withTenant(schoolId, (tx) =>
      tx.enrollment.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
});

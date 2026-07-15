import { z } from 'zod';
import { router, tenantProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { logEvent } from '../services/learning-events';

export const enrollmentRouter = router({
  enroll: tenantProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
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

  myEnrollments: tenantProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;
    const userId = ctx.userId;
    return withTenant(schoolId, (tx) =>
      tx.enrollment.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
});

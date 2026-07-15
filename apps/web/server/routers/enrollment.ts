import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, tenantProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { logEvent } from '../services/learning-events';

export const enrollmentRouter = router({
  enroll: tenantProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      const result = await withTenant(schoolId, async (tx) => {
        const course = await tx.course.findUnique({
          where: { id: input.courseId },
          select: { id: true, status: true },
        });
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
        if (course.status !== 'PUBLISHED') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Course is not published' });
        }
        return tx.enrollment.upsert({
          where: { courseId_userId: { userId, courseId: input.courseId } },
          create: { userId, courseId: input.courseId, role: 'STUDENT' },
          update: {},
        });
      });
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

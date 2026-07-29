import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { withTenant, type Prisma } from '@parta5/db';
import { logEvent } from '../services/learning-events';
import { assertCanEditCourse } from '../services/authz';

/**
 * Idempotent enroll-many helper shared by `enrollUsers` / `enrollGroup`.
 * Only active users belonging to `schoolId` are enrolled; the rest are
 * silently skipped (reported back as `skipped`) rather than failing the
 * whole batch — rosters routinely include people who left the school.
 */
async function upsertEnrollments(
  tx: Prisma.TransactionClient,
  courseId: string,
  candidateUserIds: string[],
  role: 'STUDENT' | 'TEACHER',
  schoolId: string,
): Promise<{ enrolled: number; skipped: number }> {
  if (candidateUserIds.length === 0) {
    return { enrolled: 0, skipped: 0 };
  }
  const validUsers = await tx.user.findMany({
    where: { id: { in: candidateUserIds }, schoolId, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    validUsers.map((u) =>
      tx.enrollment.upsert({
        where: { courseId_userId: { courseId, userId: u.id } },
        create: { courseId, userId: u.id, role },
        update: { role },
      }),
    ),
  );
  return { enrolled: validUsers.length, skipped: candidateUserIds.length - validUsers.length };
}

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

  listByCourse: teacherProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.courseId, ctx.userId, ctx.session.user.role);
        return tx.enrollment.findMany({
          where: { courseId: input.courseId },
          include: {
            user: { select: { id: true, name: true, email: true, isActive: true } },
          },
          orderBy: { createdAt: 'asc' },
        });
      });
    }),

  // Note: unlike the student-facing `enroll` above, this is NOT restricted to
  // PUBLISHED courses — a teacher preparing a draft course needs to enroll
  // students ahead of publishing it.
  enrollUsers: teacherProcedure
    .input(
      z.object({
        courseId: z.string().uuid(),
        userIds: z.array(z.string().uuid()).min(1),
        role: z.enum(['STUDENT', 'TEACHER']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const result = await withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.courseId, ctx.userId, ctx.session.user.role);
        return upsertEnrollments(tx, input.courseId, input.userIds, input.role, schoolId);
      });
      void logEvent({
        schoolId,
        actorId: ctx.userId,
        verb: 'enrolled',
        objectType: 'course',
        objectId: input.courseId,
      });
      return result;
    }),

  enrollGroup: teacherProcedure
    .input(
      z.object({
        courseId: z.string().uuid(),
        groupId: z.string().uuid(),
        role: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const result = await withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.courseId, ctx.userId, ctx.session.user.role);
        const memberships = await tx.groupMembership.findMany({
          where: { groupId: input.groupId },
          select: { userId: true },
        });
        return upsertEnrollments(
          tx,
          input.courseId,
          memberships.map((m) => m.userId),
          input.role,
          schoolId,
        );
      });
      void logEvent({
        schoolId,
        actorId: ctx.userId,
        verb: 'enrolled',
        objectType: 'course',
        objectId: input.courseId,
      });
      return result;
    }),

  unenroll: teacherProcedure
    .input(z.object({ courseId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const result = await withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.courseId, ctx.userId, ctx.session.user.role);
        // Attempts and grades are intentionally left in place — only the
        // enrollment link is removed.
        return tx.enrollment.deleteMany({
          where: { courseId: input.courseId, userId: input.userId },
        });
      });
      void logEvent({
        schoolId,
        actorId: ctx.userId,
        verb: 'unenrolled',
        objectType: 'course',
        objectId: input.courseId,
      });
      return result;
    }),
});

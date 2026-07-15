import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { withTenant, type Prisma } from '@parta5/db';
import { assertCanEditCourse } from '../services/authz';

async function requireLessonCourseId(
  tx: Prisma.TransactionClient,
  lessonId: string,
): Promise<string> {
  const lesson = await tx.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
  }
  return lesson.module.courseId;
}

async function requireModuleCourseId(
  tx: Prisma.TransactionClient,
  moduleId: string,
): Promise<string> {
  const mod = await tx.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!mod) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Module not found' });
  }
  return mod.courseId;
}

export const lessonRouter = router({
  listByModule: tenantProcedure
    .input(z.object({ moduleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.lesson.findMany({
          where: { moduleId: input.moduleId },
          orderBy: { order: 'asc' },
          include: { blocks: { orderBy: { order: 'asc' } } },
        }),
      );
    }),

  get: tenantProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, (tx) =>
      tx.lesson.findUniqueOrThrow({
        where: { id: input.id },
        include: { blocks: { orderBy: { order: 'asc' } } },
      }),
    );
  }),

  create: teacherProcedure
    .input(z.object({ moduleId: z.string().uuid(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const courseId = await requireModuleCourseId(tx, input.moduleId);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        const count = await tx.lesson.count({ where: { moduleId: input.moduleId } });
        return tx.lesson.create({
          data: { title: input.title, moduleId: input.moduleId, schoolId, order: count },
        });
      });
    }),

  update: teacherProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const courseId = await requireLessonCourseId(tx, id);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        return tx.lesson.update({ where: { id }, data });
      });
    }),

  delete: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const courseId = await requireLessonCourseId(tx, input.id);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        return tx.lesson.delete({ where: { id: input.id } });
      });
    }),
});

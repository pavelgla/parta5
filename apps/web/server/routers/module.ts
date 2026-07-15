import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { withTenant, type Prisma } from '@parta5/db';
import { assertCanEditCourse } from '../services/authz';

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

export const moduleRouter = router({
  listByCourse: tenantProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.module.findMany({
          where: { courseId: input.courseId },
          orderBy: { order: 'asc' },
        }),
      );
    }),

  create: teacherProcedure
    .input(z.object({ courseId: z.string().uuid(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.courseId, ctx.userId, ctx.session.user.role);
        const count = await tx.module.count({ where: { courseId: input.courseId } });
        return tx.module.create({
          data: { title: input.title, courseId: input.courseId, schoolId, order: count },
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
        const courseId = await requireModuleCourseId(tx, id);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        return tx.module.update({ where: { id }, data });
      });
    }),

  delete: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const courseId = await requireModuleCourseId(tx, input.id);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        return tx.module.delete({ where: { id: input.id } });
      });
    }),
});

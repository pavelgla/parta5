import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';

export const moduleRouter = router({
  listByCourse: protectedProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) =>
        tx.module.findMany({
          where: { courseId: input.courseId },
          orderBy: { order: 'asc' },
        }),
      );
    }),

  create: protectedProcedure
    .input(z.object({ courseId: z.string().uuid(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, async (tx) => {
        const count = await tx.module.count({ where: { courseId: input.courseId } });
        return tx.module.create({
          data: { title: input.title, courseId: input.courseId, schoolId, order: count },
        });
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.module.update({ where: { id }, data }));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.module.delete({ where: { id: input.id } }));
    }),
});

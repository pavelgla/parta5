import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';

export const lessonRouter = router({
  listByModule: protectedProcedure
    .input(z.object({ moduleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) =>
        tx.lesson.findMany({
          where: { moduleId: input.moduleId },
          orderBy: { order: 'asc' },
          include: { blocks: { orderBy: { order: 'asc' } } },
        }),
      );
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) =>
        tx.lesson.findUniqueOrThrow({
          where: { id: input.id },
          include: { blocks: { orderBy: { order: 'asc' } } },
        }),
      );
    }),

  create: protectedProcedure
    .input(z.object({ moduleId: z.string().uuid(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, async (tx) => {
        const count = await tx.lesson.count({ where: { moduleId: input.moduleId } });
        return tx.lesson.create({
          data: { title: input.title, moduleId: input.moduleId, schoolId, order: count },
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
      return withTenant(schoolId, (tx) => tx.lesson.update({ where: { id }, data }));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.lesson.delete({ where: { id: input.id } }));
    }),
});

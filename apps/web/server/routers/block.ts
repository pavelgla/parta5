import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant, type Prisma } from '@parta5/db';

const ContentBlockType = z.enum(['TEXT', 'VIDEO', 'FILE']);
const JsonObject = z.record(z.string(), z.unknown());

export const blockRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        lessonId: z.string().uuid(),
        type: ContentBlockType,
        data: JsonObject,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, async (tx) => {
        const count = await tx.contentBlock.count({ where: { lessonId: input.lessonId } });
        return tx.contentBlock.create({
          data: {
            type: input.type,
            data: input.data as Prisma.InputJsonValue,
            lessonId: input.lessonId,
            schoolId,
            order: count,
          },
        });
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: JsonObject.optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, data, order } = input;
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) =>
        tx.contentBlock.update({
          where: { id },
          data: {
            ...(data !== undefined && { data: data as Prisma.InputJsonValue }),
            ...(order !== undefined && { order }),
          },
        }),
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.contentBlock.delete({ where: { id: input.id } }));
    }),
});

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant, type Prisma } from '@parta5/db';
import { BlockDataSchema } from '../schemas/block-data';

export const blockRouter = router({
  create: protectedProcedure
    .input(BlockDataSchema.and(z.object({ lessonId: z.string().uuid() })))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const { lessonId, type, data } = input;
      return withTenant(schoolId, async (tx) => {
        const count = await tx.contentBlock.count({ where: { lessonId } });
        return tx.contentBlock.create({
          data: {
            type,
            data: data as Prisma.InputJsonValue,
            lessonId,
            schoolId,
            order: count,
          },
        });
      });
    }),

  update: protectedProcedure
    .input(
      z
        .object({ id: z.string().uuid() })
        .and(
          z.discriminatedUnion('type', [
            z.object({
              type: z.literal('HEADING'),
              data: z.object({
                level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
                text: z.string(),
              }),
            }),
            z.object({
              type: z.literal('TEXT'),
              data: z.object({ html: z.string(), text: z.string() }),
            }),
            z.object({
              type: z.literal('LIST'),
              data: z.object({ ordered: z.boolean(), items: z.array(z.string()) }),
            }),
            z.object({
              type: z.literal('IMAGE'),
              data: z.object({
                fileAssetId: z.string().uuid(),
                caption: z.string().optional(),
                alt: z.string().optional(),
              }),
            }),
            z.object({
              type: z.literal('VIDEO'),
              data: z.object({ videoAssetId: z.string().uuid() }),
            }),
            z.object({
              type: z.literal('VIDEO_EMBED'),
              data: z.object({
                provider: z.string(),
                url: z.string().url(),
                embedUrl: z.string().url(),
                providerVideoId: z.string().optional(),
              }),
            }),
            z.object({
              type: z.literal('FILE'),
              data: z.object({ fileAssetId: z.string().uuid(), displayName: z.string() }),
            }),
            z.object({
              type: z.literal('CALLOUT'),
              data: z.object({
                variant: z.enum(['info', 'warning', 'success', 'danger']),
                text: z.string(),
              }),
            }),
            z.object({
              type: z.literal('CODE'),
              data: z.object({ language: z.string(), code: z.string() }),
            }),
            z.object({
              type: z.literal('QUOTE'),
              data: z.object({ text: z.string(), author: z.string().optional() }),
            }),
            z.object({ type: z.literal('DIVIDER'), data: z.object({}) }),
            z.object({
              type: z.literal('EMBED_IFRAME'),
              data: z.object({ url: z.string().url(), height: z.number().int().positive() }),
            }),
          ]),
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, data } = input;
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) =>
        tx.contentBlock.update({
          where: { id },
          data: { data: data as Prisma.InputJsonValue },
        }),
      );
    }),

  reorder: protectedProcedure
    .input(z.object({ lessonId: z.string().uuid(), blockIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const { lessonId, blockIds } = input;
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, async (tx) => {
        await Promise.all(
          blockIds.map((id, index) =>
            tx.contentBlock.update({ where: { id, lessonId }, data: { order: index } }),
          ),
        );
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.contentBlock.delete({ where: { id: input.id } }));
    }),
});

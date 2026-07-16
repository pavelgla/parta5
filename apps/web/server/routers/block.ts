import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, teacherProcedure } from '../trpc/init';
import { withTenant, type Prisma } from '@parta5/db';
import { BLOCK_TYPES, parseBlockData } from '../schemas/block-data';
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

async function requireBlockCourseId(
  tx: Prisma.TransactionClient,
  blockId: string,
): Promise<string> {
  const block = await tx.contentBlock.findUnique({
    where: { id: blockId },
    select: { lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!block) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Block not found' });
  }
  return block.lesson.module.courseId;
}

export const blockRouter = router({
  create: teacherProcedure
    .input(
      z.object({
        lessonId: z.string().uuid(),
        type: z.enum(BLOCK_TYPES),
        data: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const { lessonId, type, data } = input;
      const parsedData = parseBlockData(type, data);
      return withTenant(schoolId, async (tx) => {
        const courseId = await requireLessonCourseId(tx, lessonId);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        const count = await tx.contentBlock.count({ where: { lessonId } });
        const block = await tx.contentBlock.create({
          data: {
            type,
            data: parsedData as Prisma.InputJsonValue,
            lessonId,
            schoolId,
            order: count,
          },
        });
        return {
          id: block.id,
          type: block.type as string,
          data: block.data as Record<string, unknown>,
          order: block.order,
        };
      });
    }),

  update: teacherProcedure
    .input(
      z.object({ id: z.string().uuid() }).and(
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
              fileAssetId: z.string().uuid().optional(),
              caption: z.string().optional(),
              alt: z.string().optional(),
            }),
          }),
          z.object({
            type: z.literal('VIDEO'),
            data: z.object({ videoAssetId: z.string().uuid().optional() }),
          }),
          z.object({
            type: z.literal('VIDEO_EMBED'),
            data: z.object({
              provider: z.string().optional(),
              url: z.string().optional(),
              embedUrl: z.string().optional(),
              providerVideoId: z.string().optional(),
            }),
          }),
          z.object({
            type: z.literal('FILE'),
            data: z.object({ fileAssetId: z.string().uuid().optional(), displayName: z.string() }),
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
            data: z.object({
              url: z.string().optional(),
              height: z.number().int().positive().optional(),
            }),
          }),
          z.object({
            type: z.literal('QUIZ'),
            data: z.object({
              quizId: z.string().uuid().or(z.literal('')).optional(),
              title: z.string().optional(),
            }),
          }),
        ]),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, data } = input;
      const schoolId = ctx.schoolId;
      await withTenant(schoolId, async (tx) => {
        const courseId = await requireBlockCourseId(tx, id);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        return tx.contentBlock.update({
          where: { id },
          data: { data: data as Prisma.InputJsonValue },
        });
      });
      return { id };
    }),

  reorder: teacherProcedure
    .input(z.object({ lessonId: z.string().uuid(), blockIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const { lessonId, blockIds } = input;
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const courseId = await requireLessonCourseId(tx, lessonId);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        await Promise.all(
          blockIds.map((id, index) =>
            tx.contentBlock.update({ where: { id, lessonId }, data: { order: index } }),
          ),
        );
      });
    }),

  delete: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      await withTenant(schoolId, async (tx) => {
        const courseId = await requireBlockCourseId(tx, input.id);
        await assertCanEditCourse(tx, courseId, ctx.userId, ctx.session.user.role);
        return tx.contentBlock.delete({ where: { id: input.id } });
      });
      return { id: input.id };
    }),
});

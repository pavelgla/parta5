import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@parta5/db';
import { withTenant } from '@parta5/db';
import { router, teacherProcedure } from '../trpc/init';

export const quizRouter = router({
  list: teacherProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, (tx) =>
      tx.quiz.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { quizQuestions: true, attempts: true } } },
      }),
    );
  }),

  byId: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.quiz.findUniqueOrThrow({
          where: { id: input.id },
          include: {
            quizQuestions: {
              orderBy: { order: 'asc' },
              include: { question: { select: { id: true, type: true, name: true } } },
            },
          },
        }),
      );
    }),

  create: teacherProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        timeLimitSeconds: z.number().int().positive().optional(),
        maxAttempts: z.number().int().positive().optional(),
        passingScore: z.number().min(0).optional(),
        shuffleQuestions: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.quiz.create({
          data: { ...input, schoolId, createdById: ctx.userId },
        }),
      );
    }),

  update: teacherProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional().nullable(),
        timeLimitSeconds: z.number().int().positive().optional().nullable(),
        maxAttempts: z.number().int().positive().optional().nullable(),
        passingScore: z.number().min(0).optional().nullable(),
        shuffleQuestions: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.quiz.update({ where: { id }, data: data as Prisma.QuizUncheckedUpdateInput }),
      );
    }),

  setQuestions: teacherProcedure
    .input(
      z.object({
        quizId: z.string().uuid(),
        items: z.array(z.object({ questionId: z.string().uuid(), points: z.number().positive() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await tx.quizQuestion.deleteMany({ where: { quizId: input.quizId } });
        await tx.quizQuestion.createMany({
          data: input.items.map((item, index) => ({
            schoolId,
            quizId: input.quizId,
            questionId: item.questionId,
            points: item.points,
            order: index,
          })),
        });
        return tx.quizQuestion.findMany({
          where: { quizId: input.quizId },
          orderBy: { order: 'asc' },
        });
      });
    }),

  delete: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const attemptCount = await tx.quizAttempt.count({ where: { quizId: input.id } });
        if (attemptCount > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Нельзя удалить тест: есть попытки прохождения',
          });
        }
        return tx.quiz.delete({ where: { id: input.id } });
      });
    }),
});

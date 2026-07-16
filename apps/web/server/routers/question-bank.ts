import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@parta5/db';
import { withTenant } from '@parta5/db';
import { questionData, sanitizeQuestionHtml } from '@parta5/quiz';
import { router, teacherProcedure } from '../trpc/init';

/**
 * Defense-in-depth: a compromised teacher account shouldn't be able to plant
 * XSS in question HTML that students then load via dangerouslySetInnerHTML.
 * `data` is unvalidated user input here, so every field access is guarded.
 */
function sanitizeQuestionInputData(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = { ...obj };

  if (typeof obj.prompt === 'string') {
    sanitized.prompt = sanitizeQuestionHtml(obj.prompt).html;
  }

  if (obj.type === 'MULTICHOICE' && Array.isArray(obj.choices)) {
    sanitized.choices = obj.choices.map((choice) => {
      if (choice === null || typeof choice !== 'object') return choice;
      const c = choice as Record<string, unknown>;
      const sanitizedChoice: Record<string, unknown> = { ...c };
      if (typeof c.text === 'string') {
        sanitizedChoice.text = sanitizeQuestionHtml(c.text).html;
      }
      if (typeof c.feedback === 'string') {
        sanitizedChoice.feedback = sanitizeQuestionHtml(c.feedback).html;
      }
      return sanitizedChoice;
    });
  }

  return sanitized;
}

export const questionBankRouter = router({
  list: teacherProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, (tx) =>
      tx.questionBank.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { questions: true } } },
      }),
    );
  }),

  create: teacherProcedure
    .input(z.object({ name: z.string().min(1).max(200), parentId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.questionBank.create({
          data: {
            name: input.name,
            parentId: input.parentId,
            schoolId,
            createdById: ctx.userId,
          },
        }),
      );
    }),

  rename: teacherProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.questionBank.update({ where: { id: input.id }, data: { name: input.name } }),
      );
    }),

  delete: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const count = await tx.question.count({ where: { bankId: input.id } });
        if (count > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Нельзя удалить банк: в нём ${count} вопрос(ов)`,
          });
        }
        return tx.questionBank.delete({ where: { id: input.id } });
      });
    }),

  questions: teacherProcedure
    .input(
      z.object({
        bankId: z.string().uuid(),
        cursor: z.string().uuid().optional(),
        take: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const rows = await tx.question.findMany({
          where: { bankId: input.bankId },
          orderBy: { id: 'asc' },
          take: input.take + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          select: { id: true, type: true, name: true, updatedAt: true },
        });
        let nextCursor: string | undefined;
        if (rows.length > input.take) {
          nextCursor = rows.pop()!.id;
        }
        return { items: rows, nextCursor };
      });
    }),

  questionById: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.question.findUniqueOrThrow({ where: { id: input.id } }),
      );
    }),

  createQuestion: teacherProcedure
    .input(
      z.object({ bankId: z.string().uuid(), name: z.string().min(1).max(200), data: z.unknown() }),
    )
    .mutation(async ({ ctx, input }) => {
      const parsed = questionData.safeParse(sanitizeQuestionInputData(input.data));
      if (!parsed.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: JSON.stringify(parsed.error.issues),
        });
      }
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.question.create({
          data: {
            bankId: input.bankId,
            name: input.name,
            type: parsed.data.type,
            data: parsed.data as Prisma.InputJsonValue,
            schoolId,
            createdById: ctx.userId,
          },
        }),
      );
    }),

  updateQuestion: teacherProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        data: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parsed = questionData.safeParse(sanitizeQuestionInputData(input.data));
      if (!parsed.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: JSON.stringify(parsed.error.issues),
        });
      }
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const current = await tx.question.findUniqueOrThrow({
          where: { id: input.id },
          select: { version: true },
        });
        return tx.question.update({
          where: { id: input.id },
          data: {
            ...(input.name ? { name: input.name } : {}),
            type: parsed.data.type,
            data: parsed.data as Prisma.InputJsonValue,
            version: current.version + 1,
          },
        });
      });
    }),

  deleteQuestion: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const usages = await tx.quizQuestion.findMany({
          where: { questionId: input.id },
          select: { quiz: { select: { title: true } } },
        });
        if (usages.length > 0) {
          const titles = usages.map((u) => u.quiz.title).join(', ');
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Вопрос используется в тестах: ${titles}`,
          });
        }
        return tx.question.delete({ where: { id: input.id } });
      });
    }),
});

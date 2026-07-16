import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@parta5/db';
import { withTenant, UserRole } from '@parta5/db';
import {
  multichoiceAnswer,
  shortanswerAnswer,
  truefalseAnswer,
  type QuestionData,
} from '@parta5/quiz';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { stripAnswers } from '../lib/quiz-sanitize';
import { finalizeAttempt, type SnapshotItem } from '../lib/finalize-attempt';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function answerSchemaFor(type: QuestionData['type']) {
  switch (type) {
    case 'MULTICHOICE':
      return multichoiceAnswer;
    case 'TRUEFALSE':
      return truefalseAnswer;
    case 'SHORTANSWER':
      return shortanswerAnswer;
  }
}

function sanitizedQuestions(attempt: { questionsSnapshot: Prisma.JsonValue }) {
  const snapshot = attempt.questionsSnapshot as unknown as SnapshotItem[];
  return snapshot.map((item) => ({
    questionId: item.questionId,
    order: item.order,
    points: item.points,
    data: stripAnswers(item.data),
  }));
}

function sanitizeAttemptForClient(attempt: {
  id: string;
  quizId: string;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
  questionsSnapshot: Prisma.JsonValue;
}) {
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    questions: sanitizedQuestions(attempt),
  };
}

async function assertQuizAccess(
  tx: Prisma.TransactionClient,
  quizId: string,
  userId: string,
  role: UserRole,
): Promise<void> {
  if (TEACHER_ROLES.includes(role)) return;

  const blocks = await tx.contentBlock.findMany({
    where: { type: 'QUIZ', data: { path: ['quizId'], equals: quizId } },
    select: { lesson: { select: { module: { select: { courseId: true } } } } },
  });
  const courseIds = blocks.map((b) => b.lesson.module.courseId);
  if (courseIds.length === 0) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Quiz is not attached to any course' });
  }
  const enrollment = await tx.enrollment.findFirst({
    where: { userId, courseId: { in: courseIds } },
  });
  if (!enrollment) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not enrolled in a course with this quiz' });
  }
}

export const attemptRouter = router({
  start: tenantProcedure
    .input(z.object({ quizId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      const role = ctx.session.user.role;

      const attempt = await withTenant(schoolId, async (tx) => {
        const quiz = await tx.quiz.findUnique({
          where: { id: input.quizId },
          include: { quizQuestions: { orderBy: { order: 'asc' }, include: { question: true } } },
        });
        if (!quiz) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz not found' });
        }

        await assertQuizAccess(tx, input.quizId, userId, role);

        const active = await tx.quizAttempt.findFirst({
          where: { quizId: input.quizId, userId, status: 'IN_PROGRESS' },
        });
        if (active) {
          if (!active.expiresAt || active.expiresAt > new Date()) {
            return active;
          }
          await finalizeAttempt(tx, active, 'EXPIRED');
        }

        if (quiz.maxAttempts != null) {
          const finishedCount = await tx.quizAttempt.count({
            where: { quizId: input.quizId, userId, status: { in: ['SUBMITTED', 'EXPIRED'] } },
          });
          if (finishedCount >= quiz.maxAttempts) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Достигнут лимит попыток' });
          }
        }

        const orderedQuestions = quiz.quizQuestions.map((qq) => ({
          questionId: qq.questionId,
          points: qq.points,
          data: qq.question.data as unknown as QuestionData,
        }));
        const arranged = quiz.shuffleQuestions ? shuffle(orderedQuestions) : orderedQuestions;
        const snapshot: SnapshotItem[] = arranged.map((item, index) => ({
          questionId: item.questionId,
          order: index,
          points: item.points,
          data: item.data,
        }));
        const maxScore = snapshot.reduce((sum, item) => sum + item.points, 0);
        const expiresAt = quiz.timeLimitSeconds
          ? new Date(Date.now() + quiz.timeLimitSeconds * 1000)
          : null;

        return tx.quizAttempt.create({
          data: {
            schoolId,
            quizId: input.quizId,
            userId,
            questionsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            maxScore,
            expiresAt,
          },
        });
      });

      return sanitizeAttemptForClient(attempt);
    }),

  answer: tenantProcedure
    .input(
      z.object({
        attemptId: z.string().uuid(),
        questionId: z.string().uuid(),
        answer: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      return withTenant(schoolId, async (tx) => {
        const attempt = await tx.quizAttempt.findUnique({ where: { id: input.attemptId } });
        if (!attempt || attempt.userId !== userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Attempt not found' });
        }
        if (attempt.status !== 'IN_PROGRESS') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Attempt is not in progress' });
        }
        if (attempt.expiresAt && attempt.expiresAt < new Date()) {
          await finalizeAttempt(tx, attempt, 'EXPIRED');
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Attempt has expired' });
        }

        const snapshot = attempt.questionsSnapshot as unknown as SnapshotItem[];
        const item = snapshot.find((q) => q.questionId === input.questionId);
        if (!item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not part of this attempt' });
        }

        const parsed = answerSchemaFor(item.data.type).safeParse(input.answer);
        if (!parsed.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: JSON.stringify(parsed.error.issues),
          });
        }

        return tx.quizResponse.upsert({
          where: {
            attemptId_questionId: { attemptId: input.attemptId, questionId: input.questionId },
          },
          create: {
            schoolId,
            attemptId: input.attemptId,
            questionId: input.questionId,
            answer: parsed.data as unknown as Prisma.InputJsonValue,
          },
          update: { answer: parsed.data as unknown as Prisma.InputJsonValue },
        });
      });
    }),

  submit: tenantProcedure
    .input(z.object({ attemptId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const userId = ctx.userId;
      return withTenant(schoolId, async (tx) => {
        const attempt = await tx.quizAttempt.findUnique({ where: { id: input.attemptId } });
        if (!attempt || attempt.userId !== userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Attempt not found' });
        }
        if (attempt.status !== 'IN_PROGRESS') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Attempt is not in progress' });
        }

        const result = await finalizeAttempt(tx, attempt, 'SUBMITTED');
        return {
          attemptId: attempt.id,
          status: 'SUBMITTED' as const,
          score: result.score,
          maxScore: result.maxScore,
          items: result.items,
        };
      });
    }),

  byId: tenantProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const schoolId = ctx.schoolId;
    const userId = ctx.userId;
    return withTenant(schoolId, async (tx) => {
      const attempt = await tx.quizAttempt.findUnique({ where: { id: input.id } });
      if (!attempt || attempt.userId !== userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Attempt not found' });
      }

      if (attempt.status === 'IN_PROGRESS') {
        const responses = await tx.quizResponse.findMany({
          where: { attemptId: attempt.id },
          select: { questionId: true, answer: true },
        });
        const answerByQuestion = new Map(responses.map((r) => [r.questionId, r.answer]));
        const base = sanitizeAttemptForClient(attempt);
        return {
          ...base,
          questions: base.questions.map((q) => ({
            ...q,
            answer: answerByQuestion.get(q.questionId) ?? null,
          })),
        };
      }

      const responses = await tx.quizResponse.findMany({
        where: { attemptId: attempt.id },
        select: { questionId: true, answer: true, isCorrect: true, earnedPoints: true },
      });
      const responseByQuestion = new Map(responses.map((r) => [r.questionId, r]));
      const snapshot = attempt.questionsSnapshot as unknown as SnapshotItem[];

      return {
        attemptId: attempt.id,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        items: snapshot.map((item) => {
          const response = responseByQuestion.get(item.questionId);
          return {
            questionId: item.questionId,
            order: item.order,
            points: item.points,
            data: item.data,
            answer: response?.answer ?? null,
            isCorrect: response?.isCorrect ?? false,
            earnedPoints: response?.earnedPoints ?? 0,
          };
        }),
      };
    });
  }),

  resultsForQuiz: teacherProcedure
    .input(z.object({ quizId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.quizAttempt.findMany({
          where: { quizId: input.quizId },
          orderBy: { startedAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
      );
    }),
});

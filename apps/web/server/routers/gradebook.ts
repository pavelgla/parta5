import { z } from 'zod';
import type { Prisma } from '@parta5/db';
import { withTenant } from '@parta5/db';
import { router, teacherProcedure } from '../trpc/init';
import { assertCanEditCourse } from '../services/authz';
import { buildGradebookCsv, type GradebookCell, type GradebookRow } from '../lib/gradebook-csv';

interface QuizColumn {
  quizId: string;
  title: string;
  lessonTitle: string;
  passingScore: number | null;
}

const FINISHED_STATUSES = ['SUBMITTED', 'EXPIRED'] as const;

async function loadGradebookData(
  tx: Prisma.TransactionClient,
  courseId: string,
): Promise<{ quizzes: QuizColumn[]; rows: GradebookRow[] }> {
  const modules = await tx.module.findMany({
    where: { courseId },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          blocks: {
            where: { type: 'QUIZ' },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  const quizMetas: Array<{ quizId: string; title: string; lessonTitle: string }> = [];
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      for (const block of lesson.blocks) {
        const data = block.data as { quizId: string; title: string };
        quizMetas.push({ quizId: data.quizId, title: data.title, lessonTitle: lesson.title });
      }
    }
  }

  const quizIds = quizMetas.map((q) => q.quizId);
  const quizInfos = quizIds.length
    ? await tx.quiz.findMany({
        where: { id: { in: quizIds } },
        select: { id: true, passingScore: true },
      })
    : [];
  const passingScoreByQuiz = new Map(quizInfos.map((q) => [q.id, q.passingScore]));

  const quizzes: QuizColumn[] = quizMetas.map((q) => ({
    ...q,
    passingScore: passingScoreByQuiz.get(q.quizId) ?? null,
  }));

  const enrollments = await tx.enrollment.findMany({
    where: { courseId, role: 'STUDENT' },
    include: { user: { select: { id: true, name: true } } },
  });
  const students = enrollments.map((e) => e.user);

  const attempts = quizIds.length
    ? await tx.quizAttempt.findMany({
        where: {
          quizId: { in: quizIds },
          userId: { in: students.map((s) => s.id) },
          status: { in: [...FINISHED_STATUSES] },
        },
        select: { quizId: true, userId: true, score: true, maxScore: true, submittedAt: true },
      })
    : [];

  const cellsMap = new Map<
    string,
    { bestScore: number; maxScore: number; attempts: number; lastAt: Date | null }
  >();
  for (const attempt of attempts) {
    const key = `${attempt.userId}:${attempt.quizId}`;
    const score = attempt.score ?? 0;
    const existing = cellsMap.get(key);
    if (!existing) {
      cellsMap.set(key, {
        bestScore: score,
        maxScore: attempt.maxScore,
        attempts: 1,
        lastAt: attempt.submittedAt,
      });
      continue;
    }
    existing.attempts += 1;
    if (score > existing.bestScore) {
      existing.bestScore = score;
      existing.maxScore = attempt.maxScore;
    }
    if (attempt.submittedAt && (!existing.lastAt || attempt.submittedAt > existing.lastAt)) {
      existing.lastAt = attempt.submittedAt;
    }
  }

  const rows: GradebookRow[] = students.map((student) => ({
    userId: student.id,
    userName: student.name,
    cells: quizMetas.map((q): GradebookCell => {
      const cell = cellsMap.get(`${student.id}:${q.quizId}`);
      return {
        quizId: q.quizId,
        bestScore: cell?.bestScore ?? null,
        maxScore: cell?.maxScore ?? null,
        attempts: cell?.attempts ?? 0,
        lastAt: cell?.lastAt ?? null,
      };
    }),
  }));

  return { quizzes, rows };
}

export const gradebookRouter = router({
  forCourse: teacherProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.courseId, ctx.userId, ctx.session.user.role);
        return loadGradebookData(tx, input.courseId);
      });
    }),

  csvForCourse: teacherProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const { quizzes, rows } = await withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.courseId, ctx.userId, ctx.session.user.role);
        return loadGradebookData(tx, input.courseId);
      });
      return buildGradebookCsv(quizzes, rows);
    }),
});

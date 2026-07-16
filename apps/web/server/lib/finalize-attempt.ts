import type { Prisma } from '@parta5/db';
import { gradeQuestion, type QuestionData } from '@parta5/quiz';

export interface SnapshotItem {
  questionId: string;
  order: number;
  points: number;
  data: QuestionData;
}

export interface ResponseRecord {
  questionId: string;
  answer: unknown;
}

export interface GradedItem {
  questionId: string;
  order: number;
  points: number;
  data: QuestionData;
  answer: unknown;
  isCorrect: boolean;
  earnedPoints: number;
}

export interface FinalizeResult {
  score: number;
  maxScore: number;
  items: GradedItem[];
}

// Pure grading logic: no answer for a question grades as 0 points, never throws.
export function computeFinalizeResult(
  snapshot: SnapshotItem[],
  responses: ResponseRecord[],
): FinalizeResult {
  const answerByQuestion = new Map(responses.map((r) => [r.questionId, r.answer]));
  const items: GradedItem[] = snapshot.map((item) => {
    const answer = answerByQuestion.get(item.questionId) ?? null;
    const { isCorrect, earnedPoints } = gradeQuestion(item.data, answer, item.points);
    return { ...item, answer, isCorrect, earnedPoints };
  });
  const score = items.reduce((sum, item) => sum + item.earnedPoints, 0);
  const maxScore = snapshot.reduce((sum, item) => sum + item.points, 0);
  return { score, maxScore, items };
}

export async function finalizeAttempt(
  tx: Prisma.TransactionClient,
  attempt: { id: string; questionsSnapshot: Prisma.JsonValue },
  status: 'SUBMITTED' | 'EXPIRED',
): Promise<FinalizeResult> {
  const snapshot = attempt.questionsSnapshot as unknown as SnapshotItem[];
  const responses = await tx.quizResponse.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, answer: true },
  });

  const result = computeFinalizeResult(snapshot, responses);
  const answeredQuestionIds = new Set(responses.map((r) => r.questionId));

  await Promise.all(
    result.items
      .filter((item) => answeredQuestionIds.has(item.questionId))
      .map((item) =>
        tx.quizResponse.update({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: item.questionId } },
          data: { isCorrect: item.isCorrect, earnedPoints: item.earnedPoints },
        }),
      ),
  );

  await tx.quizAttempt.update({
    where: { id: attempt.id },
    data: { status, score: result.score, submittedAt: new Date() },
  });

  return result;
}

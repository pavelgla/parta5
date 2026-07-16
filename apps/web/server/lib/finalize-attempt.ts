import type { Prisma } from '@parta5/db';
import { computeAttemptScore, type QuestionData, type SnapshotItem } from '@parta5/quiz';

export type { SnapshotItem } from '@parta5/quiz';

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

// Thin wrapper over @parta5/quiz's pure grader: reattaches the snapshot's
// question data/order and the raw answer, which routers/UI need but the
// worker's expire-attempts job doesn't.
export function computeFinalizeResult(
  snapshot: SnapshotItem[],
  responses: ResponseRecord[],
): FinalizeResult {
  const { score, maxScore, perQuestion } = computeAttemptScore(snapshot, responses);
  const answerByQuestion = new Map(responses.map((r) => [r.questionId, r.answer]));
  const gradeByQuestion = new Map(perQuestion.map((g) => [g.questionId, g]));
  const items: GradedItem[] = snapshot.map((item) => {
    const grade = gradeByQuestion.get(item.questionId)!;
    return {
      ...item,
      answer: answerByQuestion.get(item.questionId) ?? null,
      isCorrect: grade.isCorrect,
      earnedPoints: grade.earnedPoints,
    };
  });
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

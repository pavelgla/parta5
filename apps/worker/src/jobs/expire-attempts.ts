import { prisma, withTenant } from '@parta5/db';
import { computeAttemptScore, type SnapshotItem } from '@parta5/quiz';
import { pino } from 'pino';

const log = pino({ name: 'expire-attempts' });

// QuizAttempt has RLS forced on schoolId, so there's no single cross-tenant
// query for "all expired attempts" — School has no RLS, so we list schools
// first and scan each one under withTenant.
const BATCH_LIMIT = 100;

export async function handleExpireAttempts(): Promise<void> {
  const now = new Date();
  const schools = await prisma.school.findMany({ select: { id: true } });

  let closed = 0;
  for (const { id: schoolId } of schools) {
    if (closed >= BATCH_LIMIT) break;

    const expired = await withTenant(schoolId, (tx) =>
      tx.quizAttempt.findMany({
        where: { status: 'IN_PROGRESS', expiresAt: { lt: now } },
        take: BATCH_LIMIT - closed,
      }),
    );

    for (const attempt of expired) {
      await withTenant(schoolId, async (tx) => {
        const responses = await tx.quizResponse.findMany({
          where: { attemptId: attempt.id },
          select: { questionId: true, answer: true },
        });
        const snapshot = attempt.questionsSnapshot as unknown as SnapshotItem[];
        const { score, perQuestion } = computeAttemptScore(snapshot, responses);
        const answeredQuestionIds = new Set(responses.map((r) => r.questionId));

        await Promise.all(
          perQuestion
            .filter((item) => answeredQuestionIds.has(item.questionId))
            .map((item) =>
              tx.quizResponse.update({
                where: {
                  attemptId_questionId: { attemptId: attempt.id, questionId: item.questionId },
                },
                data: { isCorrect: item.isCorrect, earnedPoints: item.earnedPoints },
              }),
            ),
        );

        await tx.quizAttempt.update({
          where: { id: attempt.id },
          data: { status: 'EXPIRED', score, submittedAt: attempt.expiresAt ?? now },
        });
      });
      closed++;
    }
  }

  log.info({ closed }, 'Expired quiz attempts closed');
}

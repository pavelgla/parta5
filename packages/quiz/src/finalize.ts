import { gradeQuestion } from './grade.js';
import type { QuestionData } from './schemas.js';

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

export interface PerQuestionScore {
  questionId: string;
  isCorrect: boolean;
  earnedPoints: number;
}

export interface AttemptScoreResult {
  score: number;
  maxScore: number;
  perQuestion: PerQuestionScore[];
}

// Pure grading logic: no answer for a question grades as 0 points, never throws.
export function computeAttemptScore(
  snapshot: SnapshotItem[],
  responses: ResponseRecord[],
): AttemptScoreResult {
  const answerByQuestion = new Map(responses.map((r) => [r.questionId, r.answer]));
  const perQuestion: PerQuestionScore[] = snapshot.map((item) => {
    const answer = answerByQuestion.get(item.questionId) ?? null;
    const { isCorrect, earnedPoints } = gradeQuestion(item.data, answer, item.points);
    return { questionId: item.questionId, isCorrect, earnedPoints };
  });
  const score = perQuestion.reduce((sum, item) => sum + item.earnedPoints, 0);
  const maxScore = snapshot.reduce((sum, item) => sum + item.points, 0);
  return { score, maxScore, perQuestion };
}

import { describe, it, expect } from 'vitest';
import { computeAttemptScore, type SnapshotItem } from '../src/finalize.js';

const snapshot: SnapshotItem[] = [
  {
    questionId: 'q1',
    order: 0,
    points: 2,
    data: {
      type: 'TRUEFALSE',
      prompt: 'Земля круглая?',
      correctAnswer: true,
      defaultPoints: 1,
    },
  },
  {
    questionId: 'q2',
    order: 1,
    points: 3,
    data: {
      type: 'SHORTANSWER',
      prompt: 'Столица Франции?',
      acceptedAnswers: ['Париж'],
      caseSensitive: false,
      defaultPoints: 1,
    },
  },
];

describe('computeAttemptScore', () => {
  it('grades a question without an answer as zero points', () => {
    const result = computeAttemptScore(snapshot, [{ questionId: 'q1', answer: { value: true } }]);

    expect(result.maxScore).toBe(5);
    expect(result.score).toBe(2);

    const q1 = result.perQuestion.find((i) => i.questionId === 'q1')!;
    expect(q1.isCorrect).toBe(true);
    expect(q1.earnedPoints).toBe(2);

    const q2 = result.perQuestion.find((i) => i.questionId === 'q2')!;
    expect(q2.isCorrect).toBe(false);
    expect(q2.earnedPoints).toBe(0);
  });

  it('grades a partial score across multiple questions', () => {
    const result = computeAttemptScore(snapshot, [
      { questionId: 'q1', answer: { value: false } },
      { questionId: 'q2', answer: { text: 'Париж' } },
    ]);

    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(5);
    expect(result.perQuestion).toHaveLength(2);
  });

  it('grades zero when no responses were recorded', () => {
    const result = computeAttemptScore(snapshot, []);

    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(5);
    expect(result.perQuestion.every((i) => !i.isCorrect && i.earnedPoints === 0)).toBe(true);
  });
});

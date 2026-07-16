import { describe, it, expect } from 'vitest';
import { computeFinalizeResult, type SnapshotItem } from '../server/lib/finalize-attempt';

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

describe('computeFinalizeResult', () => {
  it('grades a partial score when one of two questions has no answer', () => {
    const result = computeFinalizeResult(snapshot, [{ questionId: 'q1', answer: { value: true } }]);

    expect(result.maxScore).toBe(5);
    expect(result.score).toBe(2);

    const q1 = result.items.find((i) => i.questionId === 'q1')!;
    expect(q1.isCorrect).toBe(true);
    expect(q1.earnedPoints).toBe(2);

    const q2 = result.items.find((i) => i.questionId === 'q2')!;
    expect(q2.isCorrect).toBe(false);
    expect(q2.earnedPoints).toBe(0);
    expect(q2.answer).toBeNull();
  });

  it('grades full score when all answers are correct', () => {
    const result = computeFinalizeResult(snapshot, [
      { questionId: 'q1', answer: { value: true } },
      { questionId: 'q2', answer: { text: 'Париж' } },
    ]);

    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(5);
    expect(result.items.every((i) => i.isCorrect)).toBe(true);
  });

  it('grades zero score when no answers were given', () => {
    const result = computeFinalizeResult(snapshot, []);

    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(5);
    expect(result.items.every((i) => !i.isCorrect && i.earnedPoints === 0)).toBe(true);
  });
});

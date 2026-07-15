import { describe, expect, it } from 'vitest';
import { gradeAttempt, gradeQuestion } from '../src/grade';
import type { QuestionData } from '../src/schemas';

const singleChoice: QuestionData = {
  type: 'MULTICHOICE',
  prompt: '2+2?',
  single: true,
  shuffleChoices: false,
  choices: [
    { id: 'a', text: '3', correct: false },
    { id: 'b', text: '4', correct: true },
    { id: 'c', text: '5', correct: false },
  ],
  defaultPoints: 1,
};

const multiChoice: QuestionData = {
  type: 'MULTICHOICE',
  prompt: 'Простые числа?',
  single: false,
  shuffleChoices: false,
  choices: [
    { id: 'a', text: '2', correct: true },
    { id: 'b', text: '3', correct: true },
    { id: 'c', text: '4', correct: false },
    { id: 'd', text: '5', correct: true },
  ],
  defaultPoints: 1,
};

const trueFalse: QuestionData = {
  type: 'TRUEFALSE',
  prompt: 'Земля круглая',
  correctAnswer: true,
  defaultPoints: 1,
};

const shortAnswer: QuestionData = {
  type: 'SHORTANSWER',
  prompt: 'Столица России?',
  acceptedAnswers: ['Москва'],
  caseSensitive: false,
  defaultPoints: 1,
};

describe('gradeQuestion - MULTICHOICE single', () => {
  it('awards full points for the correct choice', () => {
    const result = gradeQuestion(singleChoice, { choiceIds: ['b'] }, 2);
    expect(result).toEqual({ isCorrect: true, earnedPoints: 2 });
  });

  it('awards zero for an incorrect choice', () => {
    const result = gradeQuestion(singleChoice, { choiceIds: ['a'] }, 2);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });

  it('awards zero when more than one choice is selected', () => {
    const result = gradeQuestion(singleChoice, { choiceIds: ['a', 'b'] }, 2);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });

  it('awards zero when nothing is selected', () => {
    const result = gradeQuestion(singleChoice, { choiceIds: [] }, 2);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });
});

describe('gradeQuestion - MULTICHOICE multi', () => {
  it('awards full points for exactly the correct set', () => {
    const result = gradeQuestion(multiChoice, { choiceIds: ['a', 'b', 'd'] }, 3);
    expect(result).toEqual({ isCorrect: true, earnedPoints: 3 });
  });

  it('awards partial credit for a subset of correct choices', () => {
    // 1/3 correct selected, 0/4 incorrect selected => (1/3 - 0/4) * 3 = 1
    const result = gradeQuestion(multiChoice, { choiceIds: ['a'] }, 3);
    expect(result.isCorrect).toBe(false);
    expect(result.earnedPoints).toBeCloseTo(1);
  });

  it('clamps partial credit to zero when penalty exceeds credit', () => {
    // 1/3 correct selected, 1/4 incorrect selected => (1/3 - 1/4) = 0.0833 * 3 = 0.25 (not zero)
    // choose a case where penalty dominates: 0 correct, 1 incorrect => (0 - 1/4) clamped to 0
    const result = gradeQuestion(multiChoice, { choiceIds: ['c'] }, 3);
    expect(result.isCorrect).toBe(false);
    expect(result.earnedPoints).toBe(0);
  });

  it('is not correct when the selected set is a superset including a wrong choice', () => {
    const result = gradeQuestion(multiChoice, { choiceIds: ['a', 'b', 'c', 'd'] }, 3);
    expect(result.isCorrect).toBe(false);
  });

  it('awards zero when the question has no correct choices at all', () => {
    const noCorrect: QuestionData = {
      ...multiChoice,
      choices: multiChoice.choices.map((c) => ({ ...c, correct: false })),
    };
    const result = gradeQuestion(noCorrect, { choiceIds: ['a'] }, 3);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });
});

describe('gradeQuestion - TRUEFALSE', () => {
  it('awards full points for correct answer', () => {
    const result = gradeQuestion(trueFalse, { value: true }, 1);
    expect(result).toEqual({ isCorrect: true, earnedPoints: 1 });
  });

  it('awards zero for incorrect answer', () => {
    const result = gradeQuestion(trueFalse, { value: false }, 1);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });
});

describe('gradeQuestion - SHORTANSWER', () => {
  it('awards full points for exact match', () => {
    const result = gradeQuestion(shortAnswer, { text: 'Москва' }, 1);
    expect(result).toEqual({ isCorrect: true, earnedPoints: 1 });
  });

  it('is case-insensitive by default', () => {
    const result = gradeQuestion(shortAnswer, { text: 'москва' }, 1);
    expect(result).toEqual({ isCorrect: true, earnedPoints: 1 });
  });

  it('trims surrounding whitespace and collapses repeated spaces', () => {
    const result = gradeQuestion(shortAnswer, { text: '  Москва  ' }, 1);
    expect(result.isCorrect).toBe(true);
  });

  it('collapses internal repeated whitespace before comparing', () => {
    const q: QuestionData = {
      ...shortAnswer,
      acceptedAnswers: ['Санкт Петербург'],
    };
    const result = gradeQuestion(q, { text: 'Санкт   Петербург' }, 1);
    expect(result.isCorrect).toBe(true);
  });

  it('respects caseSensitive: true', () => {
    const q: QuestionData = { ...shortAnswer, caseSensitive: true };
    const wrong = gradeQuestion(q, { text: 'москва' }, 1);
    expect(wrong.isCorrect).toBe(false);
    const right = gradeQuestion(q, { text: 'Москва' }, 1);
    expect(right.isCorrect).toBe(true);
  });

  it('awards zero for a non-matching answer', () => {
    const result = gradeQuestion(shortAnswer, { text: 'Питер' }, 1);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });
});

describe('gradeQuestion - invalid answers', () => {
  it('returns zero without throwing for a malformed multichoice answer', () => {
    const result = gradeQuestion(singleChoice, { choiceIds: 'not-an-array' }, 2);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });

  it('returns zero without throwing for a malformed truefalse answer', () => {
    const result = gradeQuestion(trueFalse, { value: 'yes' }, 1);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });

  it('returns zero without throwing for a malformed shortanswer answer', () => {
    const result = gradeQuestion(shortAnswer, { text: 123 }, 1);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });

  it('returns zero without throwing for undefined answer', () => {
    const result = gradeQuestion(shortAnswer, undefined, 1);
    expect(result).toEqual({ isCorrect: false, earnedPoints: 0 });
  });
});

describe('gradeAttempt', () => {
  it('sums scores and maxScore across items', () => {
    const attempt = gradeAttempt([
      { question: singleChoice, points: 2, answer: { choiceIds: ['b'] } },
      { question: trueFalse, points: 1, answer: { value: false } },
      { question: shortAnswer, points: 1, answer: { text: 'Москва' } },
    ]);
    expect(attempt.maxScore).toBe(4);
    expect(attempt.score).toBe(3);
    expect(attempt.results).toHaveLength(3);
    expect(attempt.results[0]).toEqual({ isCorrect: true, earnedPoints: 2 });
    expect(attempt.results[1]).toEqual({ isCorrect: false, earnedPoints: 0 });
    expect(attempt.results[2]).toEqual({ isCorrect: true, earnedPoints: 1 });
  });

  it('returns zero score and maxScore for an empty attempt', () => {
    const attempt = gradeAttempt([]);
    expect(attempt).toEqual({ score: 0, maxScore: 0, results: [] });
  });
});

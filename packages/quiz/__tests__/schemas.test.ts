import { describe, expect, it } from 'vitest';
import {
  multichoiceAnswer,
  multichoiceQuestionData,
  questionData,
  shortanswerAnswer,
  shortanswerQuestionData,
  truefalseAnswer,
  truefalseQuestionData,
} from '../src/schemas';

describe('multichoiceQuestionData', () => {
  const base = {
    type: 'MULTICHOICE' as const,
    prompt: '<p>2+2?</p>',
    single: true,
    shuffleChoices: true,
    choices: [
      { id: 'a', text: '3', correct: false },
      { id: 'b', text: '4', correct: true },
    ],
  };

  it('parses a valid question and defaults defaultPoints to 1', () => {
    const result = multichoiceQuestionData.parse(base);
    expect(result.defaultPoints).toBe(1);
  });

  it('accepts optional feedback per choice', () => {
    const result = multichoiceQuestionData.parse({
      ...base,
      choices: [
        { id: 'a', text: '3', correct: false, feedback: 'Неверно' },
        { id: 'b', text: '4', correct: true },
      ],
    });
    expect(result.choices[0].feedback).toBe('Неверно');
  });

  it('rejects fewer than 2 choices', () => {
    expect(() =>
      multichoiceQuestionData.parse({ ...base, choices: [{ id: 'a', text: '3', correct: true }] }),
    ).toThrow();
  });

  it('rejects non-positive defaultPoints', () => {
    expect(() => multichoiceQuestionData.parse({ ...base, defaultPoints: 0 })).toThrow();
  });
});

describe('truefalseQuestionData', () => {
  it('parses a valid question and defaults defaultPoints to 1', () => {
    const result = truefalseQuestionData.parse({
      type: 'TRUEFALSE',
      prompt: 'Земля круглая',
      correctAnswer: true,
    });
    expect(result.defaultPoints).toBe(1);
  });
});

describe('shortanswerQuestionData', () => {
  it('parses a valid question and defaults caseSensitive/defaultPoints', () => {
    const result = shortanswerQuestionData.parse({
      type: 'SHORTANSWER',
      prompt: 'Столица России?',
      acceptedAnswers: ['Москва'],
    });
    expect(result.caseSensitive).toBe(false);
    expect(result.defaultPoints).toBe(1);
  });

  it('rejects empty acceptedAnswers', () => {
    expect(() =>
      shortanswerQuestionData.parse({
        type: 'SHORTANSWER',
        prompt: 'Столица России?',
        acceptedAnswers: [],
      }),
    ).toThrow();
  });
});

describe('questionData discriminated union', () => {
  it('discriminates by type', () => {
    const result = questionData.parse({
      type: 'TRUEFALSE',
      prompt: 'p',
      correctAnswer: false,
    });
    expect(result.type).toBe('TRUEFALSE');
  });

  it('rejects unknown type', () => {
    expect(() => questionData.parse({ type: 'ESSAY', prompt: 'p' })).toThrow();
  });
});

describe('answer schemas', () => {
  it('parses multichoiceAnswer', () => {
    expect(multichoiceAnswer.parse({ choiceIds: ['a', 'b'] })).toEqual({ choiceIds: ['a', 'b'] });
  });

  it('parses truefalseAnswer', () => {
    expect(truefalseAnswer.parse({ value: true })).toEqual({ value: true });
  });

  it('parses shortanswerAnswer', () => {
    expect(shortanswerAnswer.parse({ text: 'Москва' })).toEqual({ text: 'Москва' });
  });
});

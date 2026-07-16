import { describe, expect, it } from 'vitest';
import { convertQuestion } from '../../src/questions/convert';

describe('convertQuestion', () => {
  it('converts a single-answer multichoice question', () => {
    const result = convertQuestion({
      name: 'Q1',
      qtype: 'multichoice',
      questiontextHtml: '<p>2+2=?</p>',
      defaultgrade: 2,
      single: true,
      shuffleanswers: true,
      answers: [
        { text: '4', fraction: 100 },
        { text: '5', fraction: 0 },
      ],
    });

    expect(result.skipped).toBeUndefined();
    expect(result.question?.name).toBe('Q1');
    expect(result.question?.hasPluginFiles).toBe(false);
    expect(result.question?.data).toEqual({
      type: 'MULTICHOICE',
      prompt: '<p>2+2=?</p>',
      single: true,
      shuffleChoices: true,
      choices: [
        { id: '0', text: '4', correct: true },
        { id: '1', text: '5', correct: false },
      ],
      defaultPoints: 2,
    });
  });

  it('converts a multi-answer multichoice question (two answers with fraction 50)', () => {
    const result = convertQuestion({
      name: 'Q2',
      qtype: 'multichoice',
      questiontextHtml: '<p>Pick evens</p>',
      defaultgrade: 1,
      single: false,
      shuffleanswers: false,
      answers: [
        { text: '2', fraction: 50 },
        { text: '4', fraction: 50 },
        { text: '3', fraction: 0 },
      ],
    });

    expect(result.question?.data).toMatchObject({
      type: 'MULTICHOICE',
      single: false,
      choices: [
        { id: '0', text: '2', correct: true },
        { id: '1', text: '4', correct: true },
        { id: '2', text: '3', correct: false },
      ],
    });
  });

  it('falls back defaultPoints to 1 when defaultgrade is not positive', () => {
    const result = convertQuestion({
      name: 'Q3',
      qtype: 'multichoice',
      questiontextHtml: '<p>x</p>',
      defaultgrade: 0,
      single: true,
      shuffleanswers: false,
      answers: [
        { text: 'a', fraction: 100 },
        { text: 'b', fraction: 0 },
      ],
    });

    expect(result.question?.data.defaultPoints).toBe(1);
  });

  it('converts a truefalse question', () => {
    const result = convertQuestion({
      name: 'Q4',
      qtype: 'truefalse',
      questiontextHtml: '<p>Sky is blue</p>',
      defaultgrade: 1,
      answers: [
        { text: 'true', fraction: 100 },
        { text: 'false', fraction: 0 },
      ],
    });

    expect(result.question?.data).toEqual({
      type: 'TRUEFALSE',
      prompt: '<p>Sky is blue</p>',
      correctAnswer: true,
      defaultPoints: 1,
    });
  });

  it('converts a shortanswer question, case-insensitive by default', () => {
    const result = convertQuestion({
      name: 'Q5',
      qtype: 'shortanswer',
      questiontextHtml: '<p>Capital of France?</p>',
      defaultgrade: 1,
      usecase: 0,
      answers: [
        { text: 'Paris', fraction: 100 },
        { text: 'paris', fraction: 100 },
        { text: 'London', fraction: 0 },
      ],
    });

    expect(result.question?.data).toEqual({
      type: 'SHORTANSWER',
      prompt: '<p>Capital of France?</p>',
      acceptedAnswers: ['Paris', 'paris'],
      caseSensitive: false,
      defaultPoints: 1,
    });
  });

  it('marks caseSensitive true when usecase is 1', () => {
    const result = convertQuestion({
      name: 'Q6',
      qtype: 'shortanswer',
      questiontextHtml: '<p>x</p>',
      defaultgrade: 1,
      usecase: 1,
      answers: [{ text: 'Paris', fraction: 100 }],
    });

    expect(result.question?.data).toMatchObject({ caseSensitive: true });
  });

  it('skips unsupported question types with a reason', () => {
    const result = convertQuestion({
      name: 'Q7',
      qtype: 'essay',
      questiontextHtml: '<p>Write an essay</p>',
      defaultgrade: 1,
      answers: [],
    });

    expect(result.question).toBeUndefined();
    expect(result.skipped).toEqual({
      name: 'Q7',
      moodleType: 'essay',
      reason: 'тип не поддерживается в MVP',
    });
  });

  it('skips invalid multichoice (fewer than 2 choices) with a validation reason', () => {
    const result = convertQuestion({
      name: 'Q8',
      qtype: 'multichoice',
      questiontextHtml: '<p>x</p>',
      defaultgrade: 1,
      single: true,
      shuffleanswers: false,
      answers: [{ text: 'a', fraction: 100 }],
    });

    expect(result.question).toBeUndefined();
    expect(result.skipped?.name).toBe('Q8');
    expect(result.skipped?.moodleType).toBe('multichoice');
    expect(result.skipped?.reason).toBeTruthy();
  });

  it('flags hasPluginFiles from the prompt html', () => {
    const result = convertQuestion({
      name: 'Q9',
      qtype: 'truefalse',
      questiontextHtml: '<p><img src="@@PLUGINFILE@@/pic.png"></p>',
      defaultgrade: 1,
      answers: [
        { text: 'true', fraction: 100 },
        { text: 'false', fraction: 0 },
      ],
    });

    expect(result.question?.hasPluginFiles).toBe(true);
  });
});

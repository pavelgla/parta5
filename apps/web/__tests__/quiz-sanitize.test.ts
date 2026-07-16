import { describe, it, expect } from 'vitest';
import type { QuestionData } from '@parta5/quiz';
import { stripAnswers } from '../server/lib/quiz-sanitize';

describe('stripAnswers', () => {
  it('MULTICHOICE: removes choices[].correct/feedback, keeps prompt/choices.text', () => {
    const data: QuestionData = {
      type: 'MULTICHOICE',
      prompt: 'Столица России?',
      single: true,
      shuffleChoices: false,
      defaultPoints: 1,
      choices: [
        { id: 'a', text: 'Москва', correct: true, feedback: 'Верно!' },
        { id: 'b', text: 'Казань', correct: false, feedback: 'Неверно' },
      ],
    };

    const sanitized = stripAnswers(data);

    expect(sanitized.prompt).toBe('Столица России?');
    expect(sanitized).toMatchObject({
      choices: [
        { id: 'a', text: 'Москва' },
        { id: 'b', text: 'Казань' },
      ],
    });
    for (const choice of (sanitized as { choices: Record<string, unknown>[] }).choices) {
      expect(choice).not.toHaveProperty('correct');
      expect(choice).not.toHaveProperty('feedback');
    }
  });

  it('TRUEFALSE: removes correctAnswer, keeps prompt', () => {
    const data: QuestionData = {
      type: 'TRUEFALSE',
      prompt: 'Земля плоская?',
      correctAnswer: false,
      defaultPoints: 1,
    };

    const sanitized = stripAnswers(data);

    expect(sanitized.prompt).toBe('Земля плоская?');
    expect(sanitized).not.toHaveProperty('correctAnswer');
  });

  it('SHORTANSWER: removes acceptedAnswers, keeps prompt', () => {
    const data: QuestionData = {
      type: 'SHORTANSWER',
      prompt: 'Столица Франции?',
      acceptedAnswers: ['Париж', 'Paris'],
      caseSensitive: false,
      defaultPoints: 1,
    };

    const sanitized = stripAnswers(data);

    expect(sanitized.prompt).toBe('Столица Франции?');
    expect(sanitized).not.toHaveProperty('acceptedAnswers');
  });
});

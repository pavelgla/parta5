export type QuestionType = 'MULTICHOICE' | 'TRUEFALSE' | 'SHORTANSWER';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTICHOICE: 'Множественный выбор',
  TRUEFALSE: 'Верно/неверно',
  SHORTANSWER: 'Короткий ответ',
};

export interface Choice {
  id: string;
  text: string;
  correct: boolean;
  feedback?: string;
}

export interface MultichoiceData {
  type: 'MULTICHOICE';
  prompt: string;
  single: boolean;
  shuffleChoices: boolean;
  choices: Choice[];
}

export interface TruefalseData {
  type: 'TRUEFALSE';
  prompt: string;
  correctAnswer: boolean;
}

export interface ShortanswerData {
  type: 'SHORTANSWER';
  prompt: string;
  acceptedAnswers: string[];
  caseSensitive: boolean;
}

export type QuestionData = MultichoiceData | TruefalseData | ShortanswerData;

export function makeChoiceId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultDataFor(type: QuestionType): QuestionData {
  switch (type) {
    case 'MULTICHOICE':
      return {
        type: 'MULTICHOICE',
        prompt: '',
        single: true,
        shuffleChoices: false,
        choices: [
          { id: makeChoiceId(), text: '', correct: true },
          { id: makeChoiceId(), text: '', correct: false },
        ],
      };
    case 'TRUEFALSE':
      return { type: 'TRUEFALSE', prompt: '', correctAnswer: true };
    case 'SHORTANSWER':
      return { type: 'SHORTANSWER', prompt: '', acceptedAnswers: [''], caseSensitive: false };
  }
}

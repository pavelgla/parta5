import type {
  MultichoiceQuestionData,
  QuestionData,
  ShortanswerQuestionData,
  TruefalseQuestionData,
} from '@parta5/quiz';

type SanitizedChoice = { id: string; text: string };

export type SanitizedMultichoiceData = Omit<MultichoiceQuestionData, 'choices'> & {
  choices: SanitizedChoice[];
};
export type SanitizedTruefalseData = Omit<TruefalseQuestionData, 'correctAnswer'>;
export type SanitizedShortanswerData = Omit<ShortanswerQuestionData, 'acceptedAnswers'>;

export type SanitizedQuestionData =
  | SanitizedMultichoiceData
  | SanitizedTruefalseData
  | SanitizedShortanswerData;

// Strips fields that would leak the correct answer to the client before an
// attempt is finished (ADR-004: grading only happens server-side).
export function stripAnswers(data: QuestionData): SanitizedQuestionData {
  switch (data.type) {
    case 'MULTICHOICE': {
      const { choices, ...rest } = data;
      return { ...rest, choices: choices.map(({ id, text }) => ({ id, text })) };
    }
    case 'TRUEFALSE': {
      const { correctAnswer: _correctAnswer, ...rest } = data;
      return rest;
    }
    case 'SHORTANSWER': {
      const { acceptedAnswers: _acceptedAnswers, ...rest } = data;
      return rest;
    }
  }
}

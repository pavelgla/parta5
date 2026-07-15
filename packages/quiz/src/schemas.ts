import { z } from 'zod';

const choiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  correct: z.boolean(),
  feedback: z.string().optional(),
});

export const multichoiceQuestionData = z.object({
  type: z.literal('MULTICHOICE'),
  prompt: z.string(),
  single: z.boolean(),
  shuffleChoices: z.boolean(),
  choices: z.array(choiceSchema).min(2),
  defaultPoints: z.number().positive().default(1),
});

export const truefalseQuestionData = z.object({
  type: z.literal('TRUEFALSE'),
  prompt: z.string(),
  correctAnswer: z.boolean(),
  defaultPoints: z.number().positive().default(1),
});

export const shortanswerQuestionData = z.object({
  type: z.literal('SHORTANSWER'),
  prompt: z.string(),
  acceptedAnswers: z.array(z.string()).min(1),
  caseSensitive: z.boolean().default(false),
  defaultPoints: z.number().positive().default(1),
});

export const questionData = z.discriminatedUnion('type', [
  multichoiceQuestionData,
  truefalseQuestionData,
  shortanswerQuestionData,
]);

export type MultichoiceQuestionData = z.infer<typeof multichoiceQuestionData>;
export type TruefalseQuestionData = z.infer<typeof truefalseQuestionData>;
export type ShortanswerQuestionData = z.infer<typeof shortanswerQuestionData>;
export type QuestionData = z.infer<typeof questionData>;

export const multichoiceAnswer = z.object({
  choiceIds: z.array(z.string()),
});

export const truefalseAnswer = z.object({
  value: z.boolean(),
});

export const shortanswerAnswer = z.object({
  text: z.string(),
});

export type MultichoiceAnswer = z.infer<typeof multichoiceAnswer>;
export type TruefalseAnswer = z.infer<typeof truefalseAnswer>;
export type ShortanswerAnswer = z.infer<typeof shortanswerAnswer>;

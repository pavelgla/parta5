import { questionData, type QuestionData } from '@parta5/quiz';
import { sanitizeQuestionHtml } from './sanitize.js';
import type { ParsedQuestion, SkippedQuestion } from './types.js';

export interface RawAnswer {
  text: string;
  fraction: number;
  feedbackHtml?: string;
}

export interface RawQuestion {
  name: string;
  qtype: string;
  questiontextHtml: string;
  defaultgrade: number;
  single?: boolean;
  shuffleanswers?: boolean;
  usecase?: number;
  answers: RawAnswer[];
}

export interface ConvertResult {
  question?: ParsedQuestion;
  skipped?: SkippedQuestion;
}

function buildData(raw: RawQuestion, prompt: string): QuestionData {
  const defaultPoints = raw.defaultgrade > 0 ? raw.defaultgrade : 1;

  if (raw.qtype === 'multichoice') {
    return {
      type: 'MULTICHOICE',
      prompt,
      single: Boolean(raw.single),
      shuffleChoices: Boolean(raw.shuffleanswers),
      choices: raw.answers.map((answer, index) => ({
        id: String(index),
        text: answer.text,
        correct: answer.fraction > 0,
      })),
      defaultPoints,
    };
  }

  if (raw.qtype === 'truefalse') {
    const trueAnswer = raw.answers.find((answer) => answer.text.toLowerCase() === 'true');
    return {
      type: 'TRUEFALSE',
      prompt,
      correctAnswer: (trueAnswer?.fraction ?? 0) > 0,
      defaultPoints,
    };
  }

  return {
    type: 'SHORTANSWER',
    prompt,
    acceptedAnswers: raw.answers
      .filter((answer) => answer.fraction > 0)
      .map((answer) => answer.text),
    caseSensitive: raw.usecase === 1,
    defaultPoints,
  };
}

export function convertQuestion(raw: RawQuestion): ConvertResult {
  if (raw.qtype !== 'multichoice' && raw.qtype !== 'truefalse' && raw.qtype !== 'shortanswer') {
    return {
      skipped: {
        name: raw.name,
        moodleType: raw.qtype,
        reason: 'тип не поддерживается в MVP',
      },
    };
  }

  const {
    html: prompt,
    hasPluginFiles,
    unresolvedFiles: pluginFileNames,
  } = sanitizeQuestionHtml(raw.questiontextHtml);
  const data = buildData(raw, prompt);

  const result = questionData.safeParse(data);
  if (!result.success) {
    return {
      skipped: {
        name: raw.name,
        moodleType: raw.qtype,
        reason: result.error.message,
      },
    };
  }

  return {
    question: {
      name: raw.name,
      data: result.data,
      hasPluginFiles,
      pluginFileNames,
      rawPromptHtml: raw.questiontextHtml,
    },
  };
}

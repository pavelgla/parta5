import { multichoiceAnswer, QuestionData, shortanswerAnswer, truefalseAnswer } from './schemas.js';

export interface GradeResult {
  isCorrect: boolean;
  earnedPoints: number;
  feedback?: string;
}

function normalizeShortAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function gradeMultichoice(
  question: Extract<QuestionData, { type: 'MULTICHOICE' }>,
  answer: unknown,
  points: number,
): GradeResult {
  const parsed = multichoiceAnswer.safeParse(answer);
  if (!parsed.success) {
    return { isCorrect: false, earnedPoints: 0 };
  }

  const selected = new Set(parsed.data.choiceIds);
  const correctIds = new Set(question.choices.filter((c) => c.correct).map((c) => c.id));
  const isCorrect =
    selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id));

  if (question.single) {
    return { isCorrect, earnedPoints: isCorrect ? points : 0 };
  }

  const totalChoices = question.choices.length;
  const totalCorrect = correctIds.size;
  const correctSelected = [...selected].filter((id) => correctIds.has(id)).length;
  const incorrectSelected = [...selected].filter((id) => !correctIds.has(id)).length;

  const fraction =
    totalCorrect > 0 ? correctSelected / totalCorrect - incorrectSelected / totalChoices : 0;
  const clamped = Math.max(0, Math.min(1, fraction));

  return { isCorrect, earnedPoints: clamped * points };
}

function gradeTruefalse(
  question: Extract<QuestionData, { type: 'TRUEFALSE' }>,
  answer: unknown,
  points: number,
): GradeResult {
  const parsed = truefalseAnswer.safeParse(answer);
  if (!parsed.success) {
    return { isCorrect: false, earnedPoints: 0 };
  }

  const isCorrect = parsed.data.value === question.correctAnswer;
  return { isCorrect, earnedPoints: isCorrect ? points : 0 };
}

function gradeShortanswer(
  question: Extract<QuestionData, { type: 'SHORTANSWER' }>,
  answer: unknown,
  points: number,
): GradeResult {
  const parsed = shortanswerAnswer.safeParse(answer);
  if (!parsed.success) {
    return { isCorrect: false, earnedPoints: 0 };
  }

  const given = normalizeShortAnswer(parsed.data.text);
  const isCorrect = question.acceptedAnswers.some((accepted) => {
    const normalizedAccepted = normalizeShortAnswer(accepted);
    return question.caseSensitive
      ? given === normalizedAccepted
      : given.toLowerCase() === normalizedAccepted.toLowerCase();
  });

  return { isCorrect, earnedPoints: isCorrect ? points : 0 };
}

export function gradeQuestion(
  question: QuestionData,
  answer: unknown,
  points: number,
): GradeResult {
  switch (question.type) {
    case 'MULTICHOICE':
      return gradeMultichoice(question, answer, points);
    case 'TRUEFALSE':
      return gradeTruefalse(question, answer, points);
    case 'SHORTANSWER':
      return gradeShortanswer(question, answer, points);
  }
}

export interface AttemptItem {
  question: QuestionData;
  points: number;
  answer: unknown;
}

export interface AttemptResult {
  score: number;
  maxScore: number;
  results: GradeResult[];
}

export function gradeAttempt(items: AttemptItem[]): AttemptResult {
  const results = items.map((item) => gradeQuestion(item.question, item.answer, item.points));
  const score = results.reduce((sum, r) => sum + r.earnedPoints, 0);
  const maxScore = items.reduce((sum, item) => sum + item.points, 0);

  return { score, maxScore, results };
}

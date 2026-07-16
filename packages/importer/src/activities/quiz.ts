import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { toArray } from '../manifest';
import { sanitizeQuestionHtml } from '../questions/sanitize';
import { nullableString } from '../xml-common';

export interface QuizQuestionInstance {
  slot: number;
  questionbankentryid?: number;
  questionid?: number;
  maxmark: number;
}

export interface ParsedQuiz {
  name: string;
  introHtml: string | null;
  timelimit: number;
  grade: number;
  attempts: number;
  questionInstances: QuizQuestionInstance[];
}

function toQuestionInstance(raw: Record<string, unknown>): QuizQuestionInstance {
  const reference = raw.question_reference as Record<string, unknown> | undefined;

  return {
    slot: Number(raw.slot),
    ...(reference !== undefined
      ? { questionbankentryid: Number(reference.questionbankentryid) }
      : { questionid: Number(raw.questionid) }),
    maxmark: Number(raw.maxmark),
  };
}

export async function parseQuiz(backupDir: string, directory: string): Promise<ParsedQuiz> {
  const xmlPath = path.join(backupDir, directory, 'quiz.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const quiz = parsed.activity.quiz;

  const introRaw = nullableString(quiz.intro);
  const rawInstances = toArray(
    (quiz.question_instances as Record<string, unknown> | undefined)?.question_instance as
      | Record<string, unknown>
      | Record<string, unknown>[],
  );

  return {
    name: String(quiz.name ?? ''),
    introHtml: introRaw !== null ? sanitizeQuestionHtml(introRaw).html : null,
    timelimit: Number(quiz.timelimit ?? 0),
    grade: Number(quiz.grade ?? 0),
    attempts: Number(quiz.attempts ?? 0),
    questionInstances: rawInstances.map(toQuestionInstance),
  };
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createXmlParser, parseXmlBool } from '../xml.js';
import { toArray } from '../manifest.js';
import { convertQuestion, type RawAnswer, type RawQuestion } from './convert.js';
import type { ParsedQuestion, QuestionParseResult } from './types.js';

interface BackupAnswer {
  id: number;
  text: string;
  fraction: number;
  feedbackHtml?: string;
}

function parseAnswers(pluginNode: Record<string, unknown> | undefined): BackupAnswer[] {
  const answersNode = pluginNode?.answers as Record<string, unknown> | undefined;
  const rawAnswers = toArray(
    answersNode?.answer as Record<string, unknown> | Record<string, unknown>[],
  );
  return rawAnswers.map((answer) => ({
    id: Number(answer['@_id']),
    text: String(answer.answertext ?? ''),
    fraction: Number(answer.fraction ?? 0),
    feedbackHtml: answer.feedback !== undefined ? String(answer.feedback) : undefined,
  }));
}

function toRawAnswers(answers: BackupAnswer[]): RawAnswer[] {
  return answers.map(({ text, fraction, feedbackHtml }) => ({ text, fraction, feedbackHtml }));
}

function toRawQuestion(question: Record<string, unknown>): RawQuestion {
  const qtype = String(question.qtype);
  const name = String(question.name ?? '');
  const questiontextHtml = String(question.questiontext ?? '');
  const defaultgrade = question.defaultmark !== undefined ? Number(question.defaultmark) : 0;

  if (qtype === 'multichoice') {
    const plugin = question.plugin_qtype_multichoice_question as
      | Record<string, unknown>
      | undefined;
    const multichoice = plugin?.multichoice as Record<string, unknown> | undefined;
    return {
      name,
      qtype,
      questiontextHtml,
      defaultgrade,
      single: parseXmlBool(multichoice?.single),
      shuffleanswers: parseXmlBool(multichoice?.shuffleanswers),
      answers: toRawAnswers(parseAnswers(plugin)),
    };
  }

  if (qtype === 'truefalse') {
    const plugin = question.plugin_qtype_truefalse_question as Record<string, unknown> | undefined;
    const truefalse = plugin?.truefalse as Record<string, unknown> | undefined;
    const answers = parseAnswers(plugin);
    const trueId = Number(truefalse?.trueanswer);
    const falseId = Number(truefalse?.falseanswer);
    const trueFraction = answers.find((answer) => answer.id === trueId)?.fraction ?? 0;
    const falseFraction = answers.find((answer) => answer.id === falseId)?.fraction ?? 0;
    return {
      name,
      qtype,
      questiontextHtml,
      defaultgrade,
      answers: [
        { text: 'true', fraction: trueFraction },
        { text: 'false', fraction: falseFraction },
      ],
    };
  }

  if (qtype === 'shortanswer') {
    const plugin = question.plugin_qtype_shortanswer_question as
      | Record<string, unknown>
      | undefined;
    const shortanswer = plugin?.shortanswer as Record<string, unknown> | undefined;
    return {
      name,
      qtype,
      questiontextHtml,
      defaultgrade,
      usecase: shortanswer?.usecase !== undefined ? Number(shortanswer.usecase) : 0,
      answers: toRawAnswers(parseAnswers(plugin)),
    };
  }

  return { name, qtype, questiontextHtml, defaultgrade, answers: [] };
}

function pickLatestVersion(
  versions: Record<string, unknown>[],
): Record<string, unknown> | undefined {
  return versions.reduce<Record<string, unknown> | undefined>((latest, version) => {
    if (!latest) return version;
    return Number(version.version) > Number(latest.version) ? version : latest;
  }, undefined);
}

export async function parseBackupQuestions(backupDir: string): Promise<
  QuestionParseResult & {
    byId: Map<number, ParsedQuestion>;
    byEntryId: Map<number, ParsedQuestion>;
  }
> {
  const xmlPath = path.join(backupDir, 'questions.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = createXmlParser();
  const parsed = parser.parse(xml);

  const result: QuestionParseResult = { questions: [], skipped: [] };
  const byId = new Map<number, ParsedQuestion>();
  const byEntryId = new Map<number, ParsedQuestion>();

  const categories = toArray(parsed.question_categories?.question_category);

  for (const category of categories as Record<string, unknown>[]) {
    const bankEntries = (category.question_bank_entries as Record<string, unknown> | undefined)
      ?.question_bank_entry;

    if (bankEntries !== undefined) {
      for (const entry of toArray(
        bankEntries as Record<string, unknown> | Record<string, unknown>[],
      )) {
        const versions = toArray(
          (entry.question_version as Record<string, unknown> | undefined)?.question_versions as
            | Record<string, unknown>
            | Record<string, unknown>[],
        );
        const latestVersion = pickLatestVersion(versions);
        const rawQuestions = toArray(
          (latestVersion?.questions as Record<string, unknown> | undefined)?.question as
            | Record<string, unknown>
            | Record<string, unknown>[],
        );

        for (const question of rawQuestions) {
          const converted = convertQuestion(toRawQuestion(question));
          if (converted.question) {
            result.questions.push(converted.question);
            byId.set(Number(question['@_id']), converted.question);
            byEntryId.set(Number(entry['@_id']), converted.question);
          } else if (converted.skipped) {
            result.skipped.push(converted.skipped);
          }
        }
      }
      continue;
    }

    const rawQuestions = toArray(
      (category.questions as Record<string, unknown> | undefined)?.question as
        | Record<string, unknown>
        | Record<string, unknown>[],
    );

    for (const question of rawQuestions) {
      const converted = convertQuestion(toRawQuestion(question));
      if (converted.question) {
        result.questions.push(converted.question);
        byId.set(Number(question['@_id']), converted.question);
      } else if (converted.skipped) {
        result.skipped.push(converted.skipped);
      }
    }
  }

  return { ...result, byId, byEntryId };
}

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { toArray } from '../manifest';
import { convertQuestion, type RawQuestion } from './convert';
import type { QuestionParseResult } from './types';

function textValue(node: unknown): string {
  if (node === undefined || node === null) return '';
  if (typeof node === 'object') {
    return textValue((node as Record<string, unknown>).text);
  }
  return String(node);
}

function toRawQuestion(question: Record<string, unknown>): RawQuestion {
  const qtype = String(question['@_type']);
  return {
    name: textValue(question.name),
    qtype,
    questiontextHtml: textValue(question.questiontext),
    defaultgrade: question.defaultgrade !== undefined ? Number(question.defaultgrade) : 0,
    single: Boolean(question.single),
    shuffleanswers: Boolean(question.shuffleanswers),
    usecase: question.usecase !== undefined ? Number(question.usecase) : undefined,
    answers: toArray(question.answer as Record<string, unknown> | Record<string, unknown>[]).map(
      (answer) => ({
        text: textValue(answer.text),
        fraction: Number(answer['@_fraction'] ?? 0),
        feedbackHtml: answer.feedback !== undefined ? textValue(answer.feedback) : undefined,
      }),
    ),
  };
}

export function parseMoodleXml(xmlString: string): QuestionParseResult {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xmlString);
  const rawQuestions = toArray(parsed.quiz?.question);

  const result: QuestionParseResult = { questions: [], skipped: [] };

  for (const question of rawQuestions as Record<string, unknown>[]) {
    if (String(question['@_type']) === 'category') continue;

    const converted = convertQuestion(toRawQuestion(question));
    if (converted.question) {
      result.questions.push(converted.question);
    } else if (converted.skipped) {
      result.skipped.push(converted.skipped);
    }
  }

  return result;
}

export async function parseMoodleXmlFile(filePath: string): Promise<QuestionParseResult> {
  const xml = await readFile(filePath, 'utf-8');
  return parseMoodleXml(xml);
}

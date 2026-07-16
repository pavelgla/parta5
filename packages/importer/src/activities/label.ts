import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createXmlParser } from '../xml.js';
import { sanitizeQuestionHtml } from '@parta5/quiz';
import { nullableString } from '../xml-common.js';

export interface ParsedLabel {
  name: string;
  introHtml: string | null;
}

export async function parseLabel(backupDir: string, directory: string): Promise<ParsedLabel> {
  const xmlPath = path.join(backupDir, directory, 'label.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = createXmlParser();
  const parsed = parser.parse(xml);
  const label = parsed.activity.label;

  const introRaw = nullableString(label.intro);

  return {
    name: String(label.name ?? ''),
    introHtml: introRaw !== null ? sanitizeQuestionHtml(introRaw).html : null,
  };
}

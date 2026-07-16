import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { sanitizeQuestionHtml } from '../questions/sanitize';
import { nullableString } from '../xml-common';

export interface ParsedLabel {
  name: string;
  introHtml: string | null;
}

export async function parseLabel(backupDir: string, directory: string): Promise<ParsedLabel> {
  const xmlPath = path.join(backupDir, directory, 'label.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const label = parsed.activity.label;

  const introRaw = nullableString(label.intro);

  return {
    name: String(label.name ?? ''),
    introHtml: introRaw !== null ? sanitizeQuestionHtml(introRaw).html : null,
  };
}

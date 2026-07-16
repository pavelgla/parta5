import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { sanitizeQuestionHtml } from '../questions/sanitize';
import { nullableString } from '../xml-common';

export interface ParsedPage {
  name: string;
  contentHtml: string;
  introHtml: string | null;
}

export async function parsePage(backupDir: string, directory: string): Promise<ParsedPage> {
  const xmlPath = path.join(backupDir, directory, 'page.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const page = parsed.activity.page;

  const introRaw = nullableString(page.intro);

  return {
    name: String(page.name ?? ''),
    contentHtml: sanitizeQuestionHtml(String(page.content ?? '')).html,
    introHtml: introRaw !== null ? sanitizeQuestionHtml(introRaw).html : null,
  };
}

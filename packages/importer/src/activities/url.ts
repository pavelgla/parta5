import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { sanitizeQuestionHtml } from '../questions/sanitize';
import { nullableString } from '../xml-common';

export interface ParsedUrl {
  name: string;
  externalurl: string;
  introHtml: string | null;
}

export async function parseUrl(backupDir: string, directory: string): Promise<ParsedUrl> {
  const xmlPath = path.join(backupDir, directory, 'url.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const url = parsed.activity.url;

  const introRaw = nullableString(url.intro);

  return {
    name: String(url.name ?? ''),
    externalurl: String(url.externalurl ?? ''),
    introHtml: introRaw !== null ? sanitizeQuestionHtml(introRaw).html : null,
  };
}

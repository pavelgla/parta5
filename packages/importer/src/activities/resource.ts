import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { sanitizeQuestionHtml } from '../questions/sanitize';
import { nullableString } from '../xml-common';

export interface ParsedResource {
  name: string;
  introHtml: string | null;
}

export async function parseResource(backupDir: string, directory: string): Promise<ParsedResource> {
  const xmlPath = path.join(backupDir, directory, 'resource.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const resource = parsed.activity.resource;

  const introRaw = nullableString(resource.intro);

  return {
    name: String(resource.name ?? ''),
    introHtml: introRaw !== null ? sanitizeQuestionHtml(introRaw).html : null,
  };
}

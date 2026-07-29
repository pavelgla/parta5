import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createXmlParser } from './xml.js';

const NULL_MARKER = '$@NULL@$';

function nullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value);
  return str === NULL_MARKER ? null : str;
}

export interface ParsedSection {
  id: number;
  number: number;
  title: string | null;
  summaryHtml: string | null;
  sequence: number[];
}

export async function parseSection(backupDir: string, directory: string): Promise<ParsedSection> {
  const xmlPath = path.join(backupDir, directory, 'section.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = createXmlParser();
  const parsed = parser.parse(xml);
  const section = parsed.section;

  const sequenceRaw = nullableString(section.sequence);
  const sequence = sequenceRaw
    ? sequenceRaw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .map((id) => Number(id))
    : [];

  return {
    id: Number(section.id),
    number: Number(section.number),
    title: nullableString(section.name),
    summaryHtml: nullableString(section.summary),
    sequence,
  };
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createXmlParser } from '../xml.js';
import { sanitizeQuestionHtml } from '@parta5/quiz';
import { nullableString } from '../xml-common.js';

export interface ParsedSupervideo {
  name: string;
  videourl: string;
  introHtml: string | null;
}

/**
 * mod_supervideo (used by ПСР for video lessons) stores the actual video
 * reference in `videourl`: either an http(s) link (Google Drive in every
 * observed case so far) or the literal string "file" when the video was
 * uploaded straight into Moodle instead of linked externally. There is no
 * in-repo migration path for the "file" case yet — the caller is expected to
 * skip it with an explicit reason rather than silently drop the activity.
 */
export async function parseSupervideo(
  backupDir: string,
  directory: string,
): Promise<ParsedSupervideo> {
  const xmlPath = path.join(backupDir, directory, 'supervideo.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = createXmlParser();
  const parsed = parser.parse(xml);
  const supervideo = parsed.activity.supervideo;

  const introRaw = nullableString(supervideo.intro);

  return {
    name: String(supervideo.name ?? ''),
    videourl: String(supervideo.videourl ?? ''),
    introHtml: introRaw !== null ? sanitizeQuestionHtml(introRaw).html : null,
  };
}

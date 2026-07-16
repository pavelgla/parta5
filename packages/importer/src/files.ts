import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

export interface BackupFileEntry {
  id: number;
  contenthash: string;
  contextid: number;
  component: string;
  filearea: string;
  filename: string;
  filepath: string;
  mimetype: string | null;
  filesize: number;
}

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

export async function parseFilesManifest(backupDir: string): Promise<BackupFileEntry[]> {
  const xmlPath = path.join(backupDir, 'files.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const rawFiles = toArray(parsed.files?.file);

  return rawFiles
    .map((file: Record<string, unknown>) => ({
      id: Number(file.id),
      contenthash: String(file.contenthash),
      contextid: Number(file.contextid),
      component: String(file.component),
      filearea: String(file.filearea),
      filename: String(file.filename),
      filepath: String(file.filepath),
      mimetype:
        file.mimetype === undefined || file.mimetype === null ? null : String(file.mimetype),
      filesize: Number(file.filesize),
    }))
    .filter((entry) => entry.filename !== '.');
}

export function contentPath(backupDir: string, contenthash: string): string {
  return path.join(backupDir, 'files', contenthash.slice(0, 2), contenthash);
}

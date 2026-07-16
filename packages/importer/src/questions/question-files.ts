import type { BackupFileEntry } from '../files.js';

export function collectQuestionFiles(files: BackupFileEntry[]): Map<number, BackupFileEntry[]> {
  const result = new Map<number, BackupFileEntry[]>();

  for (const file of files) {
    if (file.component !== 'question' || file.filearea !== 'questiontext') continue;
    if (file.filename === '.') continue;

    const list = result.get(file.itemid);
    if (list) {
      list.push(file);
    } else {
      result.set(file.itemid, [file]);
    }
  }

  return result;
}

export function otherQuestionFileareas(files: BackupFileEntry[]): string[] {
  const areas = new Set<string>();

  for (const file of files) {
    if (file.component !== 'question') continue;
    if (file.filearea === 'questiontext') continue;
    if (file.filename === '.') continue;
    areas.add(file.filearea);
  }

  return [...areas];
}

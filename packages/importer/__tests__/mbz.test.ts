import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as tar from 'tar';
import { describe, expect, it } from 'vitest';
import { extractMbz } from '../src/mbz';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'minimal-backup');

describe('extractMbz', () => {
  it('extracts a gzip-compressed (tar.gz) .mbz archive', async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-mbz-'));
    try {
      const archivePath = path.join(workDir, 'backup.mbz');
      await tar.c({ gzip: true, file: archivePath, cwd: FIXTURE_DIR }, ['.']);

      const destDir = path.join(workDir, 'extracted');
      await extractMbz(archivePath, destDir);

      const manifestXml = await readFile(path.join(destDir, 'moodle_backup.xml'), 'utf-8');
      expect(manifestXml).toContain(
        '<original_course_shortname>testcourse</original_course_shortname>',
      );

      const fileBody = await readFile(
        path.join(destDir, 'files', 'ab', 'ab1234567890abcdef1234567890abcdef1234'),
        'utf-8',
      );
      expect(fileBody).toBe('test');
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('throws a clear error for an unrecognized file format', async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-mbz-bad-'));
    try {
      const garbagePath = path.join(workDir, 'not-a-backup.mbz');
      await writeFile(garbagePath, 'this is not an archive at all');

      const destDir = path.join(workDir, 'extracted');
      await expect(extractMbz(garbagePath, destDir)).rejects.toThrow(/Unrecognized \.mbz format/);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});

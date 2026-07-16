import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentPath, parseFilesManifest } from '../src/files';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'minimal-backup');

describe('parseFilesManifest', () => {
  it('filters out directory entries (filename === ".")', async () => {
    const files = await parseFilesManifest(FIXTURE_DIR);

    expect(files).toHaveLength(3);
    expect(files.some((f) => f.filename === '.')).toBe(false);
  });

  it('parses file entry fields', async () => {
    const files = await parseFilesManifest(FIXTURE_DIR);
    const notes = files.find((f) => f.filename === 'notes.pdf');

    expect(notes).toEqual({
      id: 2,
      contenthash: 'ab1234567890abcdef1234567890abcdef1234',
      contextid: 100,
      component: 'mod_resource',
      filearea: 'content',
      itemid: 0,
      filename: 'notes.pdf',
      filepath: '/',
      mimetype: 'application/pdf',
      filesize: 4,
    });
  });
});

describe('contentPath', () => {
  it('builds the path from the first two hash characters', () => {
    const result = contentPath('/backups/course-1', 'ab1234567890abcdef1234567890abcdef1234');

    expect(result).toBe(
      path.join('/backups/course-1', 'files', 'ab', 'ab1234567890abcdef1234567890abcdef1234'),
    );
  });
});

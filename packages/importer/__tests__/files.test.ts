import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentPath, findCourseCoverFile, parseFilesManifest } from '../src/files';
import type { BackupFileEntry } from '../src/files';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'minimal-backup');

describe('parseFilesManifest', () => {
  it('filters out directory entries (filename === ".")', async () => {
    const files = await parseFilesManifest(FIXTURE_DIR);

    expect(files).toHaveLength(4);
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

describe('findCourseCoverFile', () => {
  it('picks the course/overviewfiles image, ignoring same-named files from other components', async () => {
    const files = await parseFilesManifest(FIXTURE_DIR);
    const cover = findCourseCoverFile(files);

    // The fixture also contains a `cover.png` under mod_page/content — a decoy
    // that must NOT be mistaken for the real course cover.
    expect(cover?.filename).toBe('course-cover.jpg');
    expect(cover?.component).toBe('course');
    expect(cover?.filearea).toBe('overviewfiles');
  });

  it('ignores the directory placeholder entry (filename ".") even if not pre-filtered', () => {
    const entries: BackupFileEntry[] = [
      {
        id: 1,
        contenthash: 'aaaa',
        contextid: 26,
        component: 'course',
        filearea: 'overviewfiles',
        itemid: 0,
        filename: '.',
        filepath: '/',
        mimetype: null,
        filesize: 0,
      },
    ];

    expect(findCourseCoverFile(entries)).toBeNull();
  });

  it('returns null when the backup has no course cover', () => {
    const entries: BackupFileEntry[] = [
      {
        id: 1,
        contenthash: 'bbbb',
        contextid: 100,
        component: 'mod_resource',
        filearea: 'content',
        itemid: 0,
        filename: 'notes.pdf',
        filepath: '/',
        mimetype: 'application/pdf',
        filesize: 4,
      },
    ];

    expect(findCourseCoverFile(entries)).toBeNull();
  });
});

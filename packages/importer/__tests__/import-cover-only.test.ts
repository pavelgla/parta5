import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@parta5/db';
import type { StorageAdapter } from '@parta5/storage';
import { importCoverOnly } from '../src/import-cover-only';

/** Throws on every call — proves the no-cover path never touches the DB or storage. */
function createUntouchableDb(): PrismaClient {
  const fail = () => {
    throw new Error('db should not be touched when the backup has no course cover');
  };
  return new Proxy(
    {},
    {
      get() {
        return fail;
      },
    },
  ) as PrismaClient;
}

function createUntouchableStorage(): StorageAdapter {
  const fail = async () => {
    throw new Error('storage should not be touched when the backup has no course cover');
  };
  return {
    presignUpload: fail,
    publicUrl: () => {
      throw new Error('storage should not be touched when the backup has no course cover');
    },
    presignDownload: fail,
    delete: fail,
    headObject: fail,
    getObjectStream: fail,
    putObjectFromPath: fail,
  } as unknown as StorageAdapter;
}

async function writeBackupWithoutCover(tmpDir: string, fullname: string): Promise<void> {
  await writeFile(
    path.join(tmpDir, 'files.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<files>\n</files>\n',
    'utf-8',
  );

  await writeFile(
    path.join(tmpDir, 'moodle_backup.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<moodle_backup>
  <information>
    <moodle_version>2024100700</moodle_version>
    <moodle_release>5.0.6</moodle_release>
    <backup_date>1735689600</backup_date>
    <original_course_fullname>${fullname}</original_course_fullname>
    <original_course_shortname>nocovercourse</original_course_shortname>
    <contents>
      <activities></activities>
      <sections></sections>
    </contents>
  </information>
</moodle_backup>
`,
    'utf-8',
  );
}

describe('importCoverOnly (no cover in backup)', () => {
  it('reports no-cover-in-backup without touching the DB or storage', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-cover-only-'));
    try {
      await writeBackupWithoutCover(tmpDir, 'Курс без обложки');

      const result = await importCoverOnly({
        backupDir: tmpDir,
        schoolId: '11111111-1111-1111-1111-111111111111',
        createdById: '22222222-2222-2222-2222-222222222222',
        storage: createUntouchableStorage(),
        db: createUntouchableDb(),
      });

      expect(result).toEqual({
        status: 'no-cover-in-backup',
        courseFullname: 'Курс без обложки',
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('importCoverOnly (cover present)', () => {
  it('finds the cover via findCourseCoverFile and ignores the directory placeholder entry', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-cover-only-present-'));
    try {
      await mkdir(path.join(tmpDir, 'files', '99'), { recursive: true });
      await writeFile(
        path.join(tmpDir, 'files', '99', '9988776655443322110099887766554433221100'),
        'fake-image-bytes',
        'utf-8',
      );

      await writeFile(
        path.join(tmpDir, 'files.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<files>
  <file id="1">
    <id>1</id>
    <contenthash>9988776655443322110099887766554433221100</contenthash>
    <contextid>26</contextid>
    <component>course</component>
    <filearea>overviewfiles</filearea>
    <itemid>0</itemid>
    <filepath>/</filepath>
    <filename>сварщик.png</filename>
    <mimetype>image/png</mimetype>
    <filesize>17</filesize>
  </file>
  <file id="2">
    <id>2</id>
    <contenthash>9988776655443322110099887766554433221100</contenthash>
    <contextid>26</contextid>
    <component>course</component>
    <filearea>overviewfiles</filearea>
    <itemid>0</itemid>
    <filepath>/</filepath>
    <filename>.</filename>
    <mimetype></mimetype>
    <filesize>0</filesize>
  </file>
</files>
`,
        'utf-8',
      );

      await writeFile(
        path.join(tmpDir, 'moodle_backup.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<moodle_backup>
  <information>
    <moodle_version>2024100700</moodle_version>
    <moodle_release>5.0.6</moodle_release>
    <backup_date>1735689600</backup_date>
    <original_course_fullname>Газосварщик</original_course_fullname>
    <original_course_shortname>gazosvarshik</original_course_shortname>
    <contents>
      <activities></activities>
      <sections></sections>
    </contents>
  </information>
</moodle_backup>
`,
        'utf-8',
      );

      // No DB match — proves the lookup runs (and the "no-course-match" path is
      // reached) without needing a live database, since findMany on an
      // uninitialized in-memory course table returns no rows.
      const fakeCourses: Array<{ id: string; title: string; coverFileAssetId: string | null }> = [];
      const fakeTx = {
        $executeRaw: async () => 0,
        course: {
          findMany: async () => fakeCourses,
        },
      };
      const fakeDb = {
        $transaction: async (fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx),
      } as unknown as PrismaClient;

      const result = await importCoverOnly({
        backupDir: tmpDir,
        schoolId: '11111111-1111-1111-1111-111111111111',
        createdById: '22222222-2222-2222-2222-222222222222',
        storage: createUntouchableStorage(),
        db: fakeDb,
      });

      expect(result).toEqual({
        status: 'no-course-match',
        courseFullname: 'Газосварщик',
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import type { StorageAdapter } from '@parta5/storage';
import { importCourse } from '../src/import-course';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'minimal-backup');

function createFakeStorage(): StorageAdapter & {
  calls: Array<{ key: string; localPath: string }>;
} {
  const calls: Array<{ key: string; localPath: string }> = [];
  return {
    calls,
    async presignUpload() {
      throw new Error('not implemented');
    },
    publicUrl(key: string) {
      return `https://cdn.example.com/${key}`;
    },
    async delete() {
      // no-op
    },
    async headObject() {
      return null;
    },
    async getObjectStream(): Promise<NodeJS.ReadableStream> {
      throw new Error('not implemented');
    },
    async putObjectFromPath(key: string, localPath: string) {
      calls.push({ key, localPath });
    },
  };
}

describe('importCourse (dryRun)', () => {
  it('produces a full report without touching storage', async () => {
    const storage = createFakeStorage();

    const report = await importCourse({
      backupDir: FIXTURE_DIR,
      schoolId: '11111111-1111-1111-1111-111111111111',
      createdById: '22222222-2222-2222-2222-222222222222',
      storage,
      dryRun: true,
    });

    expect(report.courseTitle).toBe('Test Course');
    expect(report.courseSlug).toMatch(/^testcourse-[A-Za-z0-9_-]{6}$/);
    expect(report.modules).toBe(3);
    expect(report.lessons).toBe(5);
    expect(report.blocks).toBe(5);
    expect(report.files).toEqual({ count: 1, totalBytes: 4 });
    expect(report.warnings).toEqual([]);
    expect(report.skippedActivities).toEqual([
      { modulename: 'quiz', title: 'Chapter 1 quiz', reason: 'quiz: импорт в следующей задаче' },
    ]);
    expect(storage.calls).toHaveLength(0);
  });
});

describe('importCourse (sequence handling)', () => {
  it('appends activities missing from the section sequence to the end with a warning', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-import-course-'));
    try {
      await mkdir(path.join(tmpDir, 'sections', 'section_1'), { recursive: true });
      await mkdir(path.join(tmpDir, 'activities', 'label_1'), { recursive: true });
      await mkdir(path.join(tmpDir, 'activities', 'label_2'), { recursive: true });

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
    <original_course_fullname>Sequence Course</original_course_fullname>
    <original_course_shortname>seqcourse</original_course_shortname>
    <contents>
      <activities>
        <activity>
          <moduleid>1</moduleid>
          <sectionid>1</sectionid>
          <modulename>label</modulename>
          <title>In sequence</title>
          <directory>activities/label_1</directory>
        </activity>
        <activity>
          <moduleid>2</moduleid>
          <sectionid>1</sectionid>
          <modulename>label</modulename>
          <title>Missing from sequence</title>
          <directory>activities/label_2</directory>
        </activity>
      </activities>
      <sections>
        <section>
          <sectionid>1</sectionid>
          <title>Only section</title>
          <directory>sections/section_1</directory>
        </section>
      </sections>
    </contents>
  </information>
</moodle_backup>
`,
        'utf-8',
      );

      await writeFile(
        path.join(tmpDir, 'sections', 'section_1', 'section.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<section id="1">
  <id>1</id>
  <number>1</number>
  <name>Only section</name>
  <summary>$@NULL@$</summary>
  <sequence>1</sequence>
  <visible>1</visible>
</section>
`,
        'utf-8',
      );

      for (const [dir, id] of [
        ['label_1', 1],
        ['label_2', 2],
      ] as const) {
        await writeFile(
          path.join(tmpDir, 'activities', dir, 'label.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>
<activity id="${id}" moduleid="${id}" modulename="label" contextid="${100 + id}">
  <label id="${id}">
    <name>Label ${id}</name>
    <intro>&lt;p&gt;Content ${id}&lt;/p&gt;</intro>
    <introformat>1</introformat>
  </label>
</activity>
`,
          'utf-8',
        );
      }

      const storage = createFakeStorage();
      const report = await importCourse({
        backupDir: tmpDir,
        schoolId: '11111111-1111-1111-1111-111111111111',
        createdById: '22222222-2222-2222-2222-222222222222',
        storage,
        dryRun: true,
      });

      expect(report.lessons).toBe(2);
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toMatch(/Missing from sequence/);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

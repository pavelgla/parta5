import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../src/manifest';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'minimal-backup');

describe('parseManifest', () => {
  it('parses course metadata', async () => {
    const manifest = await parseManifest(FIXTURE_DIR);

    expect(manifest.moodleVersion).toBe('2024100700');
    expect(manifest.moodleRelease).toBe('5.0.6');
    expect(manifest.backupDate).toBe(1735689600);
    expect(manifest.originalCourseFullname).toBe('Test Course');
    expect(manifest.originalCourseShortname).toBe('testcourse');
  });

  it('parses all sections with correct counts and fields', async () => {
    const manifest = await parseManifest(FIXTURE_DIR);

    expect(manifest.sections).toHaveLength(3);
    expect(manifest.sections[0]).toEqual({
      sectionId: 1,
      title: 'Introduction',
      directory: 'sections/section_1',
    });
    expect(manifest.sections[1]).toEqual({
      sectionId: 2,
      title: 'Chapter 1',
      directory: 'sections/section_2',
    });
    expect(manifest.sections[2]).toEqual({
      sectionId: 3,
      title: 'Extras',
      directory: 'sections/section_3',
    });
  });

  it('parses all activities with correct counts and fields', async () => {
    const manifest = await parseManifest(FIXTURE_DIR);

    expect(manifest.activities).toHaveLength(6);
    expect(manifest.activities[0]).toEqual({
      moduleId: 10,
      sectionId: 1,
      modulename: 'page',
      title: 'Welcome page',
      directory: 'activities/page_10',
    });
    expect(manifest.activities[2]).toEqual({
      moduleId: 12,
      sectionId: 2,
      modulename: 'quiz',
      title: 'Chapter 1 quiz',
      directory: 'activities/quiz_12',
    });
  });

  it('parses a single activity/section as an array, not an object', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-manifest-'));
    try {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<moodle_backup>
  <information>
    <moodle_version>2024100700</moodle_version>
    <moodle_release>5.0.6</moodle_release>
    <backup_date>1735689600</backup_date>
    <original_course_fullname>Solo Course</original_course_fullname>
    <original_course_shortname>solocourse</original_course_shortname>
    <contents>
      <activities>
        <activity>
          <moduleid>1</moduleid>
          <sectionid>1</sectionid>
          <modulename>page</modulename>
          <title>Only page</title>
          <directory>activities/page_1</directory>
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
`;
      await writeFile(path.join(tmpDir, 'moodle_backup.xml'), xml, 'utf-8');

      const manifest = await parseManifest(tmpDir);

      expect(Array.isArray(manifest.activities)).toBe(true);
      expect(manifest.activities).toHaveLength(1);
      expect(manifest.activities[0].modulename).toBe('page');

      expect(Array.isArray(manifest.sections)).toBe(true);
      expect(manifest.sections).toHaveLength(1);
      expect(manifest.sections[0].title).toBe('Only section');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

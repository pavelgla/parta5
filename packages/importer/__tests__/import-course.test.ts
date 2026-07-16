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
    async presignDownload() {
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
    expect(report.lessons).toBe(6);
    expect(report.blocks).toBe(6);
    expect(report.files).toEqual({ count: 2, totalBytes: 15 });
    expect(report.questionFiles).toEqual({ count: 1, totalBytes: 11 });
    expect(report.skippedActivities).toEqual([]);
    expect(report.quizzes).toBe(1);
    expect(report.questions).toEqual({ imported: 1, skippedByType: { essay: 1 } });
    expect(report.warnings).toEqual([
      'вопрос Q2 essay пропущен: тип не поддерживается в MVP',
      'Квиз "Chapter 1 quiz": вопрос для question_instance (slot 2) не найден, пропущен',
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

describe('importCourse (question file dedup)', () => {
  it('counts a file shared by two questions (same contenthash) only once', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-import-course-dedup-'));
    try {
      await mkdir(path.join(tmpDir, 'sections', 'section_1'), { recursive: true });
      await mkdir(path.join(tmpDir, 'activities', 'quiz_1'), { recursive: true });
      await mkdir(path.join(tmpDir, 'files', '11'), { recursive: true });

      await writeFile(
        path.join(tmpDir, 'files', '11', '1111222233334444555566667777888899990000'),
        'SHARED',
        'utf-8',
      );

      await writeFile(
        path.join(tmpDir, 'files.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<files>
  <file id="1">
    <id>1</id>
    <contenthash>1111222233334444555566667777888899990000</contenthash>
    <contextid>3</contextid>
    <component>question</component>
    <filearea>questiontext</filearea>
    <itemid>501</itemid>
    <filepath>/</filepath>
    <filename>a.png</filename>
    <mimetype>image/png</mimetype>
    <filesize>6</filesize>
  </file>
  <file id="2">
    <id>2</id>
    <contenthash>1111222233334444555566667777888899990000</contenthash>
    <contextid>3</contextid>
    <component>question</component>
    <filearea>questiontext</filearea>
    <itemid>502</itemid>
    <filepath>/</filepath>
    <filename>b.png</filename>
    <mimetype>image/png</mimetype>
    <filesize>6</filesize>
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
    <original_course_fullname>Dedup Course</original_course_fullname>
    <original_course_shortname>dedupcourse</original_course_shortname>
    <contents>
      <activities>
        <activity>
          <moduleid>1</moduleid>
          <sectionid>1</sectionid>
          <modulename>quiz</modulename>
          <title>Dup quiz</title>
          <directory>activities/quiz_1</directory>
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

      await writeFile(
        path.join(tmpDir, 'activities', 'quiz_1', 'quiz.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<activity id="1" moduleid="1" modulename="quiz" contextid="100">
  <quiz id="1">
    <name>Dup quiz</name>
    <intro></intro>
    <introformat>1</introformat>
    <timelimit>0</timelimit>
    <attempts>0</attempts>
    <grade>2.00000</grade>
    <sumgrades>2.00000</sumgrades>
    <question_instances>
      <question_instance id="1">
        <slot>1</slot>
        <page>1</page>
        <requireprevious>0</requireprevious>
        <maxmark>1.0000000</maxmark>
        <questionid>501</questionid>
      </question_instance>
      <question_instance id="2">
        <slot>2</slot>
        <page>1</page>
        <requireprevious>0</requireprevious>
        <maxmark>1.0000000</maxmark>
        <questionid>502</questionid>
      </question_instance>
    </question_instances>
  </quiz>
</activity>
`,
        'utf-8',
      );

      function multichoiceQuestion(id: number, name: string, filename: string): string {
        return `      <question id="${id}">
        <parent>0</parent>
        <name>${name}</name>
        <questiontext>&lt;p&gt;&lt;img src=&quot;@@PLUGINFILE@@/${filename}?time=1&quot;&gt;&lt;/p&gt;</questiontext>
        <questiontextformat>1</questiontextformat>
        <generalfeedback></generalfeedback>
        <generalfeedbackformat>1</generalfeedbackformat>
        <defaultmark>1.0000000</defaultmark>
        <penalty>0.3333333</penalty>
        <qtype>multichoice</qtype>
        <length>1</length>
        <stamp>abc</stamp>
        <version>abc</version>
        <hidden>0</hidden>
        <timecreated>1</timecreated>
        <timemodified>1</timemodified>
        <createdby>2</createdby>
        <modifiedby>2</modifiedby>
        <idnumber>$@NULL@$</idnumber>
        <plugin_qtype_multichoice_question>
          <answers>
            <answer id="${id}0"><answertext>A</answertext><answerformat>0</answerformat><fraction>1.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
            <answer id="${id}1"><answertext>B</answertext><answerformat>0</answerformat><fraction>0.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
          </answers>
          <multichoice id="${id}2">
            <layout>0</layout>
            <single>1</single>
            <shuffleanswers>0</shuffleanswers>
            <correctfeedback></correctfeedback>
            <correctfeedbackformat>1</correctfeedbackformat>
            <partiallycorrectfeedback></partiallycorrectfeedback>
            <partiallycorrectfeedbackformat>1</partiallycorrectfeedbackformat>
            <incorrectfeedback></incorrectfeedback>
            <incorrectfeedbackformat>1</incorrectfeedbackformat>
            <answernumbering>abc</answernumbering>
            <shownumcorrect>0</shownumcorrect>
            <showstandardinstruction>0</showstandardinstruction>
          </multichoice>
        </plugin_qtype_multichoice_question>
      </question>
`;
      }

      await writeFile(
        path.join(tmpDir, 'questions.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<question_categories>
  <question_category id="1">
    <name>Default</name>
    <contextid>3</contextid>
    <contextlevel>50</contextlevel>
    <contextinstanceid>2</contextinstanceid>
    <info></info>
    <infoformat>0</infoformat>
    <stamp>abc</stamp>
    <parent>0</parent>
    <sortorder>999</sortorder>
    <idnumber>$@NULL@$</idnumber>
    <questions>
${multichoiceQuestion(501, 'Dup Q1', 'a.png')}${multichoiceQuestion(502, 'Dup Q2', 'b.png')}    </questions>
  </question_category>
</question_categories>
`,
        'utf-8',
      );

      const storage = createFakeStorage();
      const report = await importCourse({
        backupDir: tmpDir,
        schoolId: '11111111-1111-1111-1111-111111111111',
        createdById: '22222222-2222-2222-2222-222222222222',
        storage,
        dryRun: true,
      });

      expect(report.questionFiles).toEqual({ count: 1, totalBytes: 6 });
      expect(report.warnings).toEqual([]);
      expect(storage.calls).toHaveLength(0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

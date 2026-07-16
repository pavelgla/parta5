import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { parseQuiz } from '../../src/activities/quiz';

const MODERN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<activity id="12" moduleid="12" modulename="quiz" contextid="400">
  <quiz id="5">
    <name>Chapter 1 quiz</name>
    <intro>&lt;p&gt;Quiz intro&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <timelimit>600</timelimit>
    <attempts>3</attempts>
    <grade>10.00000</grade>
    <sumgrades>3.00000</sumgrades>
    <question_instances>
      <question_instance id="1">
        <slot>1</slot>
        <page>1</page>
        <requireprevious>0</requireprevious>
        <maxmark>2.0000000</maxmark>
        <question_reference>
          <usingcontextid>3</usingcontextid>
          <component>mod_quiz</component>
          <questionarea>slot</questionarea>
          <questionbankentryid>10</questionbankentryid>
          <version>$@NULL@$</version>
        </question_reference>
      </question_instance>
      <question_instance id="2">
        <slot>2</slot>
        <page>2</page>
        <requireprevious>0</requireprevious>
        <maxmark>1.0000000</maxmark>
        <question_reference>
          <usingcontextid>3</usingcontextid>
          <component>mod_quiz</component>
          <questionarea>slot</questionarea>
          <questionbankentryid>11</questionbankentryid>
          <version>$@NULL@$</version>
        </question_reference>
      </question_instance>
    </question_instances>
  </quiz>
</activity>
`;

const LEGACY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<activity id="12" moduleid="12" modulename="quiz" contextid="400">
  <quiz id="5">
    <name>Legacy quiz</name>
    <intro>$@NULL@$</intro>
    <introformat>1</introformat>
    <timelimit>0</timelimit>
    <attempts>0</attempts>
    <grade>10.00000</grade>
    <sumgrades>3.00000</sumgrades>
    <question_instances>
      <question_instance id="1">
        <slot>1</slot>
        <page>1</page>
        <questionid>100</questionid>
        <maxmark>2.0000000</maxmark>
      </question_instance>
    </question_instances>
  </quiz>
</activity>
`;

describe('parseQuiz', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('parses the modern question_reference/questionbankentryid format', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-quiz-'));
    await mkdir(path.join(tmpDir, 'activities', 'quiz_12'), { recursive: true });
    await writeFile(path.join(tmpDir, 'activities', 'quiz_12', 'quiz.xml'), MODERN_XML, 'utf-8');

    const quiz = await parseQuiz(tmpDir, 'activities/quiz_12');

    expect(quiz.name).toBe('Chapter 1 quiz');
    expect(quiz.introHtml).toBe('<p>Quiz intro</p>');
    expect(quiz.timelimit).toBe(600);
    expect(quiz.grade).toBe(10);
    expect(quiz.attempts).toBe(3);
    expect(quiz.questionInstances).toEqual([
      { slot: 1, questionbankentryid: 10, maxmark: 2 },
      { slot: 2, questionbankentryid: 11, maxmark: 1 },
    ]);
  });

  it('parses the legacy direct-questionid format', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-quiz-'));
    await mkdir(path.join(tmpDir, 'activities', 'quiz_12'), { recursive: true });
    await writeFile(path.join(tmpDir, 'activities', 'quiz_12', 'quiz.xml'), LEGACY_XML, 'utf-8');

    const quiz = await parseQuiz(tmpDir, 'activities/quiz_12');

    expect(quiz.name).toBe('Legacy quiz');
    expect(quiz.introHtml).toBeNull();
    expect(quiz.timelimit).toBe(0);
    expect(quiz.attempts).toBe(0);
    expect(quiz.questionInstances).toEqual([{ slot: 1, questionid: 100, maxmark: 2 }]);
  });
});

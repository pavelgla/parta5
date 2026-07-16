import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMoodleXml, parseMoodleXmlFile } from '../../src/questions/moodle-xml';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category">
    <category><text>$course$/top/Default</text></category>
  </question>
  <question type="multichoice">
    <name><text>Q1 multichoice single</text></name>
    <questiontext format="html"><text><![CDATA[<p>2+2=?</p><script>alert(1)</script>]]></text></questiontext>
    <defaultgrade>2</defaultgrade>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answer fraction="100" format="html"><text>4</text><feedback format="html"><text></text></feedback></answer>
    <answer fraction="0" format="html"><text>5</text><feedback format="html"><text></text></feedback></answer>
  </question>
  <question type="multichoice">
    <name><text>Q2 multichoice multi</text></name>
    <questiontext format="html"><text><![CDATA[<p>Pick evens</p>]]></text></questiontext>
    <defaultgrade>1</defaultgrade>
    <single>false</single>
    <shuffleanswers>false</shuffleanswers>
    <answer fraction="50" format="html"><text>2</text></answer>
    <answer fraction="50" format="html"><text>4</text></answer>
    <answer fraction="0" format="html"><text>3</text></answer>
  </question>
  <question type="truefalse">
    <name><text>Q3 truefalse</text></name>
    <questiontext format="html"><text><![CDATA[<p>Sky is blue</p>]]></text></questiontext>
    <defaultgrade>1</defaultgrade>
    <answer fraction="100"><text>true</text></answer>
    <answer fraction="0"><text>false</text></answer>
  </question>
  <question type="shortanswer">
    <name><text>Q4 shortanswer</text></name>
    <questiontext format="html"><text><![CDATA[<p>Capital of France?<img src="@@PLUGINFILE@@/map.png"></p>]]></text></questiontext>
    <defaultgrade>1</defaultgrade>
    <usecase>0</usecase>
    <answer fraction="100"><text>Paris</text></answer>
  </question>
  <question type="essay">
    <name><text>Q5 essay</text></name>
    <questiontext format="html"><text><![CDATA[<p>Write about your summer</p>]]></text></questiontext>
    <defaultgrade>1</defaultgrade>
  </question>
</quiz>
`;

describe('parseMoodleXml', () => {
  it('ignores category questions', () => {
    const result = parseMoodleXml(SAMPLE_XML);
    const names = result.questions.map((q) => q.name).concat(result.skipped.map((s) => s.name));
    expect(names).not.toContain('$course$/top/Default');
  });

  it('parses a single-answer multichoice question and sanitizes html', () => {
    const result = parseMoodleXml(SAMPLE_XML);
    const q1 = result.questions.find((q) => q.name === 'Q1 multichoice single');
    expect(q1).toBeDefined();
    expect(q1?.data).toEqual({
      type: 'MULTICHOICE',
      prompt: '<p>2+2=?</p>',
      single: true,
      shuffleChoices: true,
      choices: [
        { id: '0', text: '4', correct: true },
        { id: '1', text: '5', correct: false },
      ],
      defaultPoints: 2,
    });
  });

  it('parses a multi-answer multichoice question (fraction 50/50) as single=false', () => {
    const result = parseMoodleXml(SAMPLE_XML);
    const q2 = result.questions.find((q) => q.name === 'Q2 multichoice multi');
    expect(q2?.data).toMatchObject({
      single: false,
      choices: [
        { id: '0', text: '2', correct: true },
        { id: '1', text: '4', correct: true },
        { id: '2', text: '3', correct: false },
      ],
    });
  });

  it('parses a truefalse question', () => {
    const result = parseMoodleXml(SAMPLE_XML);
    const q3 = result.questions.find((q) => q.name === 'Q3 truefalse');
    expect(q3?.data).toEqual({
      type: 'TRUEFALSE',
      prompt: '<p>Sky is blue</p>',
      correctAnswer: true,
      defaultPoints: 1,
    });
  });

  it('parses a shortanswer question and flags plugin files', () => {
    const result = parseMoodleXml(SAMPLE_XML);
    const q4 = result.questions.find((q) => q.name === 'Q4 shortanswer');
    expect(q4?.data).toEqual({
      type: 'SHORTANSWER',
      prompt: '<p>Capital of France?<img src="map.png" /></p>',
      acceptedAnswers: ['Paris'],
      caseSensitive: false,
      defaultPoints: 1,
    });
    expect(q4?.hasPluginFiles).toBe(true);
  });

  it('skips essay questions with a reason', () => {
    const result = parseMoodleXml(SAMPLE_XML);
    const essay = result.skipped.find((s) => s.name === 'Q5 essay');
    expect(essay).toEqual({
      name: 'Q5 essay',
      moodleType: 'essay',
      reason: 'тип не поддерживается в MVP',
    });
  });
});

describe('parseMoodleXmlFile', () => {
  it('reads and parses a Moodle XML file from disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'moodle-xml-'));
    const filePath = path.join(dir, 'questions.xml');
    await writeFile(filePath, SAMPLE_XML, 'utf-8');

    const result = await parseMoodleXmlFile(filePath);
    expect(result.questions).toHaveLength(4);
    expect(result.skipped).toHaveLength(1);
  });
});

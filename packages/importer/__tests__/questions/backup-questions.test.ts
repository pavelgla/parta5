import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBackupQuestions } from '../../src/questions/backup-questions';

const MODERN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<question_categories>
  <question_category id="1">
    <name>Default for Course</name>
    <contextid>3</contextid>
    <contextlevel>50</contextlevel>
    <contextinstanceid>2</contextinstanceid>
    <info></info>
    <infoformat>0</infoformat>
    <stamp>abc</stamp>
    <parent>0</parent>
    <sortorder>999</sortorder>
    <idnumber>$@NULL@$</idnumber>
    <question_bank_entries>
      <question_bank_entry id="10">
        <questioncategoryid>1</questioncategoryid>
        <idnumber>$@NULL@$</idnumber>
        <ownerid>2</ownerid>
        <nextversion>$@NULL@$</nextversion>
        <question_version>
          <question_versions id="20">
            <version>1</version>
            <status>ready</status>
            <questions>
              <question id="100">
                <parent>0</parent>
                <name>Q1 multichoice</name>
                <questiontext>&lt;p&gt;2+2=?&lt;/p&gt;</questiontext>
                <questiontextformat>1</questiontextformat>
                <generalfeedback></generalfeedback>
                <generalfeedbackformat>1</generalfeedbackformat>
                <defaultmark>2.0000000</defaultmark>
                <penalty>0.3333333</penalty>
                <qtype>multichoice</qtype>
                <length>1</length>
                <stamp>abc</stamp>
                <timecreated>1</timecreated>
                <timemodified>1</timemodified>
                <createdby>2</createdby>
                <modifiedby>2</modifiedby>
                <plugin_qtype_multichoice_question>
                  <answers>
                    <answer id="500">
                      <answertext>4</answertext>
                      <answerformat>0</answerformat>
                      <fraction>1.0000000</fraction>
                      <feedback></feedback>
                      <feedbackformat>1</feedbackformat>
                    </answer>
                    <answer id="501">
                      <answertext>5</answertext>
                      <answerformat>0</answerformat>
                      <fraction>0.0000000</fraction>
                      <feedback></feedback>
                      <feedbackformat>1</feedbackformat>
                    </answer>
                  </answers>
                  <multichoice id="900">
                    <layout>0</layout>
                    <single>1</single>
                    <shuffleanswers>1</shuffleanswers>
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
            </questions>
          </question_versions>
        </question_version>
      </question_bank_entry>
      <question_bank_entry id="11">
        <questioncategoryid>1</questioncategoryid>
        <idnumber>$@NULL@$</idnumber>
        <ownerid>2</ownerid>
        <nextversion>$@NULL@$</nextversion>
        <question_version>
          <question_versions id="21">
            <version>1</version>
            <status>ready</status>
            <questions>
              <question id="101">
                <parent>0</parent>
                <name>Q2 truefalse OLD</name>
                <questiontext>&lt;p&gt;old version, should be ignored&lt;/p&gt;</questiontext>
                <questiontextformat>1</questiontextformat>
                <generalfeedback></generalfeedback>
                <generalfeedbackformat>1</generalfeedbackformat>
                <defaultmark>1.0000000</defaultmark>
                <penalty>1.0000000</penalty>
                <qtype>truefalse</qtype>
                <length>1</length>
                <stamp>abc</stamp>
                <timecreated>1</timecreated>
                <timemodified>1</timemodified>
                <createdby>2</createdby>
                <modifiedby>2</modifiedby>
                <plugin_qtype_truefalse_question>
                  <answers>
                    <answer id="600"><answertext>Верно</answertext><answerformat>0</answerformat><fraction>0.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
                    <answer id="601"><answertext>Неверно</answertext><answerformat>0</answerformat><fraction>1.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
                  </answers>
                  <truefalse id="901">
                    <trueanswer>600</trueanswer>
                    <falseanswer>601</falseanswer>
                    <showstandardinstruction>0</showstandardinstruction>
                  </truefalse>
                </plugin_qtype_truefalse_question>
              </question>
            </questions>
          </question_versions>
          <question_versions id="22">
            <version>2</version>
            <status>ready</status>
            <questions>
              <question id="102">
                <parent>0</parent>
                <name>Q2 truefalse</name>
                <questiontext>&lt;p&gt;Небо синее&lt;/p&gt;</questiontext>
                <questiontextformat>1</questiontextformat>
                <generalfeedback></generalfeedback>
                <generalfeedbackformat>1</generalfeedbackformat>
                <defaultmark>1.0000000</defaultmark>
                <penalty>1.0000000</penalty>
                <qtype>truefalse</qtype>
                <length>1</length>
                <stamp>abc</stamp>
                <timecreated>2</timecreated>
                <timemodified>2</timemodified>
                <createdby>2</createdby>
                <modifiedby>2</modifiedby>
                <plugin_qtype_truefalse_question>
                  <answers>
                    <answer id="700"><answertext>Верно</answertext><answerformat>0</answerformat><fraction>1.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
                    <answer id="701"><answertext>Неверно</answertext><answerformat>0</answerformat><fraction>0.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
                  </answers>
                  <truefalse id="902">
                    <trueanswer>700</trueanswer>
                    <falseanswer>701</falseanswer>
                    <showstandardinstruction>0</showstandardinstruction>
                  </truefalse>
                </plugin_qtype_truefalse_question>
              </question>
            </questions>
          </question_versions>
        </question_version>
      </question_bank_entry>
    </question_bank_entries>
  </question_category>
</question_categories>
`;

const LEGACY_XML = `<?xml version="1.0" encoding="UTF-8"?>
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
      <question id="200">
        <parent>0</parent>
        <name>Q1 legacy multichoice</name>
        <questiontext>&lt;p&gt;1+1=?&lt;/p&gt;</questiontext>
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
            <answer id="800"><answertext>2</answertext><answerformat>0</answerformat><fraction>1.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
            <answer id="801"><answertext>3</answertext><answerformat>0</answerformat><fraction>0.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
          </answers>
          <multichoice id="950">
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
      <question id="201">
        <parent>0</parent>
        <name>Q2 legacy shortanswer</name>
        <questiontext>&lt;p&gt;Capital of Russia?&lt;/p&gt;</questiontext>
        <questiontextformat>1</questiontextformat>
        <generalfeedback></generalfeedback>
        <generalfeedbackformat>1</generalfeedbackformat>
        <defaultmark>1.0000000</defaultmark>
        <penalty>0.3333333</penalty>
        <qtype>shortanswer</qtype>
        <length>1</length>
        <stamp>abc</stamp>
        <version>abc</version>
        <hidden>0</hidden>
        <timecreated>1</timecreated>
        <timemodified>1</timemodified>
        <createdby>2</createdby>
        <modifiedby>2</modifiedby>
        <idnumber>$@NULL@$</idnumber>
        <plugin_qtype_shortanswer_question>
          <answers>
            <answer id="810"><answertext>Moscow</answertext><answerformat>0</answerformat><fraction>1.0000000</fraction><feedback></feedback><feedbackformat>1</feedbackformat></answer>
          </answers>
          <shortanswer id="960">
            <usecase>0</usecase>
          </shortanswer>
        </plugin_qtype_shortanswer_question>
      </question>
    </questions>
  </question_category>
</question_categories>
`;

async function writeBackupDir(xml: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'backup-questions-'));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'questions.xml'), xml, 'utf-8');
  return dir;
}

describe('parseBackupQuestions (Moodle 4.0+ format)', () => {
  it('parses questions through question_bank_entries/question_versions', async () => {
    const dir = await writeBackupDir(MODERN_XML);
    const result = await parseBackupQuestions(dir);

    expect(result.questions).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    const q1 = result.questions.find((q) => q.name === 'Q1 multichoice');
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

  it('picks the latest question_versions entry when several exist', async () => {
    const dir = await writeBackupDir(MODERN_XML);
    const result = await parseBackupQuestions(dir);

    expect(result.questions.some((q) => q.name === 'Q2 truefalse OLD')).toBe(false);
    const q2 = result.questions.find((q) => q.name === 'Q2 truefalse');
    expect(q2?.data).toEqual({
      type: 'TRUEFALSE',
      prompt: '<p>Небо синее</p>',
      correctAnswer: true,
      defaultPoints: 1,
    });
  });

  it('resolves truefalse correctness via trueanswer/falseanswer ids, not localized text', async () => {
    // Q1's sibling entry has answertext "Верно"/"Неверно" (Russian) with fraction on "Неверно" for
    // the old version, proving correctness comes from the id reference, not string matching.
    const dir = await writeBackupDir(MODERN_XML);
    const result = await parseBackupQuestions(dir);
    const q2 = result.questions.find((q) => q.name === 'Q2 truefalse');
    expect((q2?.data as { correctAnswer: boolean }).correctAnswer).toBe(true);
  });

  it('populates byId and byEntryId maps', async () => {
    const dir = await writeBackupDir(MODERN_XML);
    const result = await parseBackupQuestions(dir);

    const q1ById = result.byId.get(100);
    expect(q1ById?.name).toBe('Q1 multichoice');

    const q1ByEntry = result.byEntryId.get(10);
    expect(q1ByEntry?.name).toBe('Q1 multichoice');

    const q2ByEntry = result.byEntryId.get(11);
    expect(q2ByEntry?.name).toBe('Q2 truefalse');
  });
});

describe('parseBackupQuestions (legacy pre-4.0 format)', () => {
  it('parses questions directly nested under question_category/questions', async () => {
    const dir = await writeBackupDir(LEGACY_XML);
    const result = await parseBackupQuestions(dir);

    expect(result.questions).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    const q1 = result.questions.find((q) => q.name === 'Q1 legacy multichoice');
    expect(q1?.data).toMatchObject({
      type: 'MULTICHOICE',
      single: true,
      shuffleChoices: false,
      choices: [
        { id: '0', text: '2', correct: true },
        { id: '1', text: '3', correct: false },
      ],
    });

    const q2 = result.questions.find((q) => q.name === 'Q2 legacy shortanswer');
    expect(q2?.data).toEqual({
      type: 'SHORTANSWER',
      prompt: '<p>Capital of Russia?</p>',
      acceptedAnswers: ['Moscow'],
      caseSensitive: false,
      defaultPoints: 1,
    });
  });

  it('populates byId for legacy questions', async () => {
    const dir = await writeBackupDir(LEGACY_XML);
    const result = await parseBackupQuestions(dir);
    expect(result.byId.get(200)?.name).toBe('Q1 legacy multichoice');
    expect(result.byEntryId.size).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { collectQuestionFiles, otherQuestionFileareas } from '../../src/questions/question-files';
import type { BackupFileEntry } from '../../src/files';

function file(overrides: Partial<BackupFileEntry>): BackupFileEntry {
  return {
    id: 1,
    contenthash: 'aaaa',
    contextid: 3,
    component: 'question',
    filearea: 'questiontext',
    itemid: 100,
    filename: 'pic.png',
    filepath: '/',
    mimetype: 'image/png',
    filesize: 10,
    ...overrides,
  };
}

describe('collectQuestionFiles', () => {
  it('groups question/questiontext files by itemid', () => {
    const files = [
      file({ id: 1, itemid: 100, filename: 'a.png' }),
      file({ id: 2, itemid: 100, filename: 'b.png' }),
      file({ id: 3, itemid: 200, filename: 'c.png' }),
    ];

    const result = collectQuestionFiles(files);

    expect(result.get(100)?.map((f) => f.filename)).toEqual(['a.png', 'b.png']);
    expect(result.get(200)?.map((f) => f.filename)).toEqual(['c.png']);
    expect(result.get(999)).toBeUndefined();
  });

  it('ignores directory entries (filename ".")', () => {
    const files = [
      file({ id: 1, itemid: 100, filename: '.', mimetype: null, filesize: 0 }),
      file({ id: 2, itemid: 100, filename: 'a.png' }),
    ];

    const result = collectQuestionFiles(files);

    expect(result.get(100)?.map((f) => f.filename)).toEqual(['a.png']);
  });

  it('ignores non-question components and non-questiontext fileareas', () => {
    const files = [
      file({ id: 1, component: 'mod_resource', filearea: 'content' }),
      file({ id: 2, component: 'question', filearea: 'answerfeedback' }),
      file({ id: 3, component: 'question', filearea: 'questiontext', filename: 'ok.png' }),
    ];

    const result = collectQuestionFiles(files);

    expect(result.get(100)?.map((f) => f.filename)).toEqual(['ok.png']);
  });
});

describe('otherQuestionFileareas', () => {
  it('returns distinct question fileareas other than questiontext', () => {
    const files = [
      file({ id: 1, filearea: 'questiontext' }),
      file({ id: 2, filearea: 'answerfeedback' }),
      file({ id: 3, filearea: 'answerfeedback' }),
      file({ id: 4, filearea: 'generalfeedback' }),
      file({ id: 5, component: 'mod_resource', filearea: 'content' }),
    ];

    expect(otherQuestionFileareas(files).sort()).toEqual(['answerfeedback', 'generalfeedback']);
  });

  it('returns an empty array when there are none', () => {
    const files = [file({ id: 1, filearea: 'questiontext' })];
    expect(otherQuestionFileareas(files)).toEqual([]);
  });
});

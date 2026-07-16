import { describe, it, expect } from 'vitest';
import { SchoolKind } from '@parta5/db';
import { validateCourse } from '../server/routers/course-validation';

function courseWithLesson(overrides: Partial<Parameters<typeof validateCourse>[0]> = {}) {
  return {
    title: 'Курс',
    shortDescription: 'Краткое описание',
    subject: 'math',
    gradeLevel: 7,
    coverFileAssetId: 'asset-1',
    modules: [
      {
        id: 'mod-1',
        title: 'Модуль 1',
        lessons: [{ id: 'lesson-1', title: 'Урок 1', blocks: [{ id: 'block-1' }] }],
      },
    ],
    ...overrides,
  };
}

describe('validateCourse', () => {
  it('SCHOOL: requires subject, gradeLevel (5-11) and cover', () => {
    const course = courseWithLesson({ subject: null, gradeLevel: null, coverFileAssetId: null });

    const issues = validateCourse(course, SchoolKind.SCHOOL);

    expect(issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(['subject', 'gradeLevel', 'cover']),
    );
  });

  it('VOCATIONAL: does not require subject, gradeLevel or cover', () => {
    const course = courseWithLesson({ subject: null, gradeLevel: null, coverFileAssetId: null });

    const issues = validateCourse(course, SchoolKind.VOCATIONAL);

    expect(issues.map((i) => i.path)).not.toEqual(
      expect.arrayContaining(['subject', 'gradeLevel', 'cover']),
    );
  });

  it('VOCATIONAL: still requires title and non-empty modules/lessons/blocks', () => {
    const course = courseWithLesson({
      title: '',
      subject: null,
      gradeLevel: null,
      coverFileAssetId: null,
      modules: [],
    });

    const issues = validateCourse(course, SchoolKind.VOCATIONAL);

    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(['title', 'modules']));
  });

  it('VOCATIONAL: still validates gradeLevel range (5-11) when provided', () => {
    const course = courseWithLesson({ subject: null, coverFileAssetId: null, gradeLevel: 3 });

    const issues = validateCourse(course, SchoolKind.VOCATIONAL);

    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(['gradeLevel']));
  });
});

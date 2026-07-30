import { describe, it, expect } from 'vitest';
import { SchoolKind } from '@parta5/db';
import { validateCourse } from '../server/routers/course-validation';
import type { CourseForValidation } from '../server/routers/course-validation';

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

  it('учебный центр без краткого описания публикуется, школа — нет', () => {
    const course = courseWithLesson({ shortDescription: null });

    const vocationalIssues = validateCourse(course, SchoolKind.VOCATIONAL);
    const supplementaryIssues = validateCourse(course, SchoolKind.SUPPLEMENTARY);
    const schoolIssues = validateCourse(course, SchoolKind.SCHOOL);

    expect(vocationalIssues).toEqual([]);
    expect(supplementaryIssues).toEqual([]);
    expect(schoolIssues.map((i) => i.path)).toEqual(expect.arrayContaining(['shortDescription']));
  });
});

describe('validateCourse — пустые модули', () => {
  const withModules = (modules: CourseForValidation['modules']): CourseForValidation => ({
    title: 'Машинист перегружателей кат. E',
    shortDescription: null,
    modules,
  });

  const lesson = { id: 'l1', title: 'Урок', blocks: [{ id: 'b1' }] };

  it('публикует курс, где часть модулей — пустые заготовки разделов Moodle', () => {
    const issues = validateCourse(
      withModules([
        { id: 'm1', title: 'Общее', lessons: [lesson] },
        { id: 'm2', title: 'Topic 2', lessons: [] },
        { id: 'm3', title: 'Topic 3', lessons: [] },
      ]),
      SchoolKind.VOCATIONAL,
    );
    expect(issues).toEqual([]);
  });

  it('не публикует курс, в котором ни один модуль не содержит уроков', () => {
    const issues = validateCourse(
      withModules([
        { id: 'm1', title: 'Общее', lessons: [] },
        { id: 'm2', title: 'Topic 1', lessons: [] },
      ]),
      SchoolKind.VOCATIONAL,
    );
    expect(issues).toEqual([{ path: 'modules', message: 'Ни один модуль не содержит уроков' }]);
  });
});

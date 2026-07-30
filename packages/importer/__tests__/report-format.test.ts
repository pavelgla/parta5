import { describe, expect, it } from 'vitest';
import type { ImportReport } from '../src/report';
import { formatReport } from '../src/report-format';

function baseReport(overrides: Partial<ImportReport> = {}): ImportReport {
  return {
    courseTitle: 'Test Course',
    courseSlug: 'testcourse-ab12cd',
    modules: 3,
    skippedEmptySections: 0,
    lessons: 6,
    blocks: 8,
    files: { count: 2, totalBytes: 1572864 },
    questionFiles: { count: 0, totalBytes: 0 },
    skippedActivities: [],
    warnings: [],
    quizzes: 1,
    questions: { imported: 5, skippedByType: {} },
    courseCover: false,
    ...overrides,
  };
}

describe('formatReport', () => {
  it('formats a full report with all sections', () => {
    const report = baseReport({
      skippedActivities: [
        { modulename: 'forum', title: 'Обсуждение', reason: 'не поддерживается' },
      ],
      warnings: ['первое предупреждение'],
      questions: { imported: 5, skippedByType: { essay: 3, matching: 1 } },
      questionFiles: { count: 3, totalBytes: 1048576 },
      courseCover: true,
      skippedEmptySections: 2,
    });

    const text = formatReport(report);

    expect(text).toContain('Курс: Test Course (testcourse-ab12cd)');
    expect(text).toContain('Модулей: 3, уроков: 6, блоков: 8');
    expect(text).toContain('Пропущено пустых секций (без уроков): 2');
    expect(text).toContain('Обложка курса: перенесена');
    expect(text).toContain('Файлов: 2 (1.5 МБ)');
    expect(text).toContain('Квизов: 1, вопросов: 5');
    expect(text).toContain('Картинки вопросов: 3 (1.0 МБ)');
    expect(text).toContain('Пропущено вопросов по типам: essay=3, matching=1');
    expect(text).toContain('Пропущенные активности:');
    expect(text).toContain('- [forum] Обсуждение — не поддерживается');
    expect(text).toContain('Предупреждения:');
    expect(text).toContain('- первое предупреждение');
    expect(text).not.toContain('DRY-RUN');
  });

  it('omits optional sections when there is nothing to show', () => {
    const text = formatReport(baseReport());

    expect(text).toContain('Обложка курса: не найдена в бэкапе');
    expect(text).not.toContain('Пропущено вопросов по типам');
    expect(text).not.toContain('Пропущено пустых секций');
    expect(text).not.toContain('Пропущенные активности:');
    expect(text).not.toContain('Предупреждения:');
  });

  it('prefixes a dry-run header when dryRun is true', () => {
    const text = formatReport(baseReport(), true);

    expect(text.startsWith('DRY-RUN: изменения НЕ применены')).toBe(true);
  });

  it('truncates warnings to 20 lines and reports the remainder', () => {
    const warnings = Array.from({ length: 25 }, (_, i) => `предупреждение ${i + 1}`);
    const text = formatReport(baseReport({ warnings }));

    const lines = text.split('\n');
    const warningLines = lines.filter((l) => l.startsWith('- предупреждение'));
    expect(warningLines).toHaveLength(20);
    expect(text).toContain('… и ещё 5');
  });
});

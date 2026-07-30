import type { ImportReport } from './report.js';

const MAX_WARNING_LINES = 20;

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function formatSkippedByType(skippedByType: Record<string, number>): string | null {
  const entries = Object.entries(skippedByType);
  if (entries.length === 0) return null;
  return entries.map(([type, count]) => `${type}=${count}`).join(', ');
}

export function formatReport(report: ImportReport, dryRun = false): string {
  const lines: string[] = [];

  if (dryRun) {
    lines.push('DRY-RUN: изменения НЕ применены', '');
  }

  const courseLine = report.courseSlug
    ? `Курс: ${report.courseTitle} (${report.courseSlug})`
    : `Курс: ${report.courseTitle}`;
  lines.push(courseLine);
  lines.push(`Модулей: ${report.modules}, уроков: ${report.lessons}, блоков: ${report.blocks}`);
  lines.push(`Обложка курса: ${report.courseCover ? 'перенесена' : 'не найдена в бэкапе'}`);
  lines.push(`Файлов: ${report.files.count} (${formatMb(report.files.totalBytes)} МБ)`);
  lines.push(`Квизов: ${report.quizzes}, вопросов: ${report.questions.imported}`);
  lines.push(
    `Картинки вопросов: ${report.questionFiles.count} (${formatMb(report.questionFiles.totalBytes)} МБ)`,
  );

  const skippedByType = formatSkippedByType(report.questions.skippedByType);
  if (skippedByType) {
    lines.push(`Пропущено вопросов по типам: ${skippedByType}`);
  }

  if (report.skippedActivities.length > 0) {
    lines.push('', 'Пропущенные активности:');
    for (const activity of report.skippedActivities) {
      lines.push(`- [${activity.modulename}] ${activity.title} — ${activity.reason}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Предупреждения:');
    const shown = report.warnings.slice(0, MAX_WARNING_LINES);
    for (const warning of shown) {
      lines.push(`- ${warning}`);
    }
    if (report.warnings.length > MAX_WARNING_LINES) {
      lines.push(`… и ещё ${report.warnings.length - MAX_WARNING_LINES}`);
    }
  }

  return lines.join('\n');
}

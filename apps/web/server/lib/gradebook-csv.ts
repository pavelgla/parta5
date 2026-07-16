export interface GradebookQuizColumn {
  quizId: string;
  title: string;
}

export interface GradebookCell {
  quizId: string;
  bestScore: number | null;
  maxScore: number | null;
  attempts: number;
  lastAt: Date | string | null;
}

export interface GradebookRow {
  userId: string;
  userName: string;
  cells: GradebookCell[];
}

const CSV_DELIMITER = ';';
const CSV_NEWLINE = '\r\n';
const CSV_BOM = '﻿';

export function escapeCsvField(value: string): string {
  if (/["\n\r]/.test(value) || value.includes(CSV_DELIMITER)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function formatGradebookCell(cell: GradebookCell): string {
  if (cell.bestScore == null || cell.maxScore == null || cell.attempts === 0) {
    return '';
  }
  return `${formatNumber(cell.bestScore)}/${formatNumber(cell.maxScore)} (${cell.attempts} поп.)`;
}

export function buildGradebookCsv(quizzes: GradebookQuizColumn[], rows: GradebookRow[]): string {
  const header = ['Ученик', ...quizzes.map((q) => escapeCsvField(q.title))].join(CSV_DELIMITER);

  const lines = rows.map((row) => {
    const cellByQuiz = new Map(row.cells.map((cell) => [cell.quizId, cell]));
    const values = quizzes.map((q) => {
      const cell = cellByQuiz.get(q.quizId);
      return cell ? escapeCsvField(formatGradebookCell(cell)) : '';
    });
    return [escapeCsvField(row.userName), ...values].join(CSV_DELIMITER);
  });

  return CSV_BOM + [header, ...lines].join(CSV_NEWLINE);
}

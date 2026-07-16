import { describe, it, expect } from 'vitest';
import {
  buildGradebookCsv,
  escapeCsvField,
  formatGradebookCell,
  type GradebookCell,
  type GradebookQuizColumn,
} from '../server/lib/gradebook-csv';

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('Иванов Иван')).toBe('Иванов Иван');
  });

  it('wraps and doubles quotes when the value contains a semicolon', () => {
    expect(escapeCsvField('Иванов; Иван')).toBe('"Иванов; Иван"');
  });

  it('wraps and escapes embedded double quotes', () => {
    expect(escapeCsvField('Тест "Алгебра"')).toBe('"Тест ""Алгебра"""');
  });

  it('wraps values containing newlines', () => {
    expect(escapeCsvField('строка1\nстрока2')).toBe('"строка1\nстрока2"');
  });
});

describe('formatGradebookCell', () => {
  it('formats a completed cell as "score/max (N поп.)"', () => {
    const cell: GradebookCell = {
      quizId: 'q1',
      bestScore: 7.5,
      maxScore: 10,
      attempts: 2,
      lastAt: null,
    };
    expect(formatGradebookCell(cell)).toBe('7.5/10 (2 поп.)');
  });

  it('formats integer scores without a decimal point', () => {
    const cell: GradebookCell = {
      quizId: 'q1',
      bestScore: 10,
      maxScore: 10,
      attempts: 1,
      lastAt: null,
    };
    expect(formatGradebookCell(cell)).toBe('10/10 (1 поп.)');
  });

  it('returns empty string when there are no attempts', () => {
    const cell: GradebookCell = {
      quizId: 'q1',
      bestScore: null,
      maxScore: null,
      attempts: 0,
      lastAt: null,
    };
    expect(formatGradebookCell(cell)).toBe('');
  });
});

describe('buildGradebookCsv', () => {
  const quizzes: GradebookQuizColumn[] = [
    { quizId: 'q1', title: 'Квиз 1' },
    { quizId: 'q2', title: 'Квиз; 2' },
  ];

  it('starts with a UTF-8 BOM', () => {
    const csv = buildGradebookCsv(quizzes, []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('builds a header row with escaped quiz titles', () => {
    const csv = buildGradebookCsv(quizzes, []);
    const [header] = csv.slice(1).split('\r\n');
    expect(header).toBe('Ученик;Квиз 1;"Квиз; 2"');
  });

  it('renders a row with a filled cell and an empty cell', () => {
    const rows = [
      {
        userId: 'u1',
        userName: 'Петров Пётр',
        cells: [
          { quizId: 'q1', bestScore: 8, maxScore: 10, attempts: 1, lastAt: null },
          { quizId: 'q2', bestScore: null, maxScore: null, attempts: 0, lastAt: null },
        ],
      },
    ];
    const csv = buildGradebookCsv(quizzes, rows);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('Петров Пётр;8/10 (1 поп.);');
  });

  it('escapes a student name containing a semicolon', () => {
    const rows = [{ userId: 'u1', userName: 'Иванов; Иван', cells: [] }];
    const csv = buildGradebookCsv([], rows);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('"Иванов; Иван"');
  });
});

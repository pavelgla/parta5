import { describe, it, expect } from 'vitest';
import { parseRosterCsv } from '../server/roster/parse-roster-csv';

/**
 * Minimal Windows-1251 encoder for test fixtures only (Node has no built-in
 * encoder for it, just a decoder). Covers ASCII + the Cyrillic letters used
 * in these tests — not a general-purpose implementation.
 */
function encodeWin1251(str: string): Buffer {
  const bytes: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      bytes.push(code);
      continue;
    }
    if (code === 0x401) {
      bytes.push(0xa8); // Ё
      continue;
    }
    if (code === 0x451) {
      bytes.push(0xb8); // ё
      continue;
    }
    if (code >= 0x410 && code <= 0x42f) {
      bytes.push(0xc0 + (code - 0x410)); // А-Я
      continue;
    }
    if (code >= 0x430 && code <= 0x44f) {
      bytes.push(0xe0 + (code - 0x430)); // а-я
      continue;
    }
    throw new Error(`unsupported char in win1251 test fixture: ${ch}`);
  }
  return Buffer.from(bytes);
}

describe('parseRosterCsv', () => {
  it('parses a plain UTF-8 comma-separated file', () => {
    const csv = ['name,email,role,group', 'Ivan Petrov,ivan@school.ru,STUDENT,10A'].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, name: 'Ivan Petrov', email: 'ivan@school.ru', role: 'STUDENT', group: '10A' },
    ]);
  });

  it('parses UTF-8 with a BOM', () => {
    const csv = '﻿' + ['name,email,role,group', 'Ivan,ivan@school.ru,STUDENT,10A'].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Ivan');
  });

  it('parses Windows-1251 encoded files (Excel RU default)', () => {
    const csv = ['name,email,role,group', 'Иванов Иван,ivanov@school.ru,ученик,10А'].join('\n');
    const result = parseRosterCsv(encodeWin1251(csv));
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        line: 2,
        name: 'Иванов Иван',
        email: 'ivanov@school.ru',
        role: 'STUDENT',
        group: '10А',
      },
    ]);
  });

  it('auto-detects semicolon delimiter', () => {
    const csv = ['name;email;role;group', 'Anna;anna@school.ru;TEACHER;'].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, name: 'Anna', email: 'anna@school.ru', role: 'TEACHER', group: null },
    ]);
  });

  it('auto-detects comma delimiter', () => {
    const csv = ['name,email,role,group', 'Anna,anna@school.ru,TEACHER,'].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.errors).toEqual([]);
    expect(result.rows[0].role).toBe('TEACHER');
  });

  it('accepts Russian headers and Russian role names', () => {
    const csv = [
      'имя,email,роль,группа',
      'Пётр,petr@school.ru,преподаватель,',
      'Мария,maria@school.ru,слушатель,10Б',
    ].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, name: 'Пётр', email: 'petr@school.ru', role: 'TEACHER', group: null },
      { line: 3, name: 'Мария', email: 'maria@school.ru', role: 'STUDENT', group: '10Б' },
    ]);
  });

  it('supports quoted fields containing the delimiter', () => {
    const csv = [
      'name,email,role,group',
      '"Petrov, Ivan",ivan@school.ru,STUDENT,"10A, group 2"',
    ].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.errors).toEqual([]);
    expect(result.rows[0].name).toBe('Petrov, Ivan');
    expect(result.rows[0].group).toBe('10A, group 2');
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const csv = ['name,email,role,group', '"Ivan ""The Great""",ivan@school.ru,STUDENT,'].join(
      '\n',
    );
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.rows[0].name).toBe('Ivan "The Great"');
  });

  it('reports broken rows as errors without aborting the parse', () => {
    const csv = [
      'name,email,role,group',
      ',noemail@school.ru,STUDENT,10A', // empty name
      'No Email,not-an-email,STUDENT,10A', // invalid email
      'Bad Role,badrole@school.ru,ASTRONAUT,10A', // unknown role
      'Good Row,good@school.ru,STUDENT,10A', // valid
    ].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.rows).toEqual([
      { line: 5, name: 'Good Row', email: 'good@school.ru', role: 'STUDENT', group: '10A' },
    ]);
    expect(result.errors).toEqual([
      { line: 2, reason: 'Пустое имя' },
      { line: 3, reason: 'Невалидный email: "not-an-email"' },
      { line: 4, reason: 'Неизвестная роль: "ASTRONAUT"' },
    ]);
  });

  it('reports duplicate emails within the file as an error on the later row', () => {
    const csv = [
      'name,email,role,group',
      'Ivan,ivan@school.ru,STUDENT,10A',
      'Ivan Duplicate,IVAN@school.ru,STUDENT,10B',
    ].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].email).toBe('ivan@school.ru');
    expect(result.errors).toEqual([{ line: 3, reason: 'Дубль email в файле: "IVAN@school.ru"' }]);
  });

  it('skips trailing blank lines without producing spurious errors', () => {
    const csv = ['name,email,role,group', 'Ivan,ivan@school.ru,STUDENT,10A', '', ''].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it('throws when the header is missing required columns', () => {
    const csv = ['name,email', 'Ivan,ivan@school.ru'].join('\n');
    expect(() => parseRosterCsv(Buffer.from(csv, 'utf-8'))).toThrow();
  });

  it('throws on a completely empty file', () => {
    expect(() => parseRosterCsv(Buffer.from('', 'utf-8'))).toThrow();
  });

  it('treats the group column as optional', () => {
    const csv = ['name,email,role', 'Ivan,ivan@school.ru,STUDENT'].join('\n');
    const result = parseRosterCsv(Buffer.from(csv, 'utf-8'));
    expect(result.errors).toEqual([]);
    expect(result.rows[0].group).toBeNull();
  });
});

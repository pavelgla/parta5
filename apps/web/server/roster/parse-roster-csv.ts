/**
 * Pure CSV roster parser — no DB access, so it can be unit-tested in full.
 * Used by `user.importRoster` to turn an uploaded file into rows ready for
 * user/group creation.
 *
 * Supported quirks (see docs/STAGE-D-SPEC.md):
 * - Encoding: UTF-8 or Windows-1251 (Excel in RU saves as 1251). Detected by
 *   trying a strict UTF-8 decode first.
 * - Delimiter: `,` or `;`, picked by counting occurrences in the header line.
 * - Header required: name,email,role,group (RU aliases: имя,роль,группа).
 *   `group` column is optional — files without it just get `group: null`.
 * - Role accepts TEACHER/STUDENT and RU преподаватель/ученик/слушатель.
 * - Quoted fields with embedded delimiters/quotes are supported (RFC4180-ish).
 * - Broken rows don't abort the parse — they land in `errors` with a line
 *   number and a human-readable reason.
 */

export interface ParsedRosterRow {
  /** 1-based line number in the source file (header is line 1). */
  line: number;
  name: string;
  email: string;
  role: 'TEACHER' | 'STUDENT';
  group: string | null;
}

export interface RosterRowError {
  line: number;
  reason: string;
}

export interface ParseRosterCsvResult {
  rows: ParsedRosterRow[];
  errors: RosterRowError[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  имя: 'name',
  фио: 'name',
  email: 'email',
  почта: 'email',
  role: 'role',
  роль: 'role',
  group: 'group',
  группа: 'group',
};

const ROLE_ALIASES: Record<string, 'TEACHER' | 'STUDENT'> = {
  teacher: 'TEACHER',
  преподаватель: 'TEACHER',
  учитель: 'TEACHER',
  student: 'STUDENT',
  ученик: 'STUDENT',
  слушатель: 'STUDENT',
  студент: 'STUDENT',
};

function decodeRosterBuffer(input: Buffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1251').decode(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(text: string): ',' | ';' {
  const newlineIdx = text.search(/\r\n|\r|\n/);
  const firstLine = newlineIdx === -1 ? text : text.slice(0, newlineIdx);
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** RFC4180-ish tokenizer: quotes escape delimiters/newlines, `""` is a literal quote. */
function tokenizeCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function isBlankRecord(record: string[]): boolean {
  return record.every((f) => f.trim() === '');
}

function normalizeHeaderName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? key;
}

function normalizeRole(raw: string): 'TEACHER' | 'STUDENT' | null {
  return ROLE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export function parseRosterCsv(input: Buffer | Uint8Array): ParseRosterCsvResult {
  const text = decodeRosterBuffer(input);
  const delimiter = detectDelimiter(text);
  const records = tokenizeCsv(text, delimiter);

  while (records.length > 0 && isBlankRecord(records[records.length - 1])) {
    records.pop();
  }

  if (records.length === 0) {
    throw new Error('Пустой файл');
  }

  const header = records[0].map((h) => normalizeHeaderName(h));
  const nameIdx = header.indexOf('name');
  const emailIdx = header.indexOf('email');
  const roleIdx = header.indexOf('role');
  const groupIdx = header.indexOf('group');

  if (nameIdx === -1 || emailIdx === -1 || roleIdx === -1) {
    throw new Error('В заголовке CSV должны быть колонки name, email, role (или имя, email, роль)');
  }

  const rows: ParsedRosterRow[] = [];
  const errors: RosterRowError[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    const line = i + 1;
    if (isBlankRecord(record)) continue;

    const name = (record[nameIdx] ?? '').trim();
    const emailRaw = (record[emailIdx] ?? '').trim();
    const roleRaw = (record[roleIdx] ?? '').trim();
    const group = groupIdx === -1 ? null : (record[groupIdx] ?? '').trim() || null;
    const emailKey = emailRaw.toLowerCase();

    if (!name) {
      errors.push({ line, reason: 'Пустое имя' });
      continue;
    }
    if (!EMAIL_RE.test(emailRaw)) {
      errors.push({ line, reason: `Невалидный email: "${emailRaw}"` });
      continue;
    }
    const role = normalizeRole(roleRaw);
    if (!role) {
      errors.push({ line, reason: `Неизвестная роль: "${roleRaw}"` });
      continue;
    }
    if (seenEmails.has(emailKey)) {
      errors.push({ line, reason: `Дубль email в файле: "${emailRaw}"` });
      continue;
    }
    seenEmails.add(emailKey);
    rows.push({ line, name, email: emailRaw, role, group });
  }

  return { rows, errors };
}

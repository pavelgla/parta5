import { parseArgs } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@parta5/db';
import { createStorageFromEnv } from '@parta5/storage';
import type { StorageAdapter } from '@parta5/storage';
import { extractMbz } from './mbz';
import { importCourse } from './import-course';
import { formatReport } from './report-format';

// Не покрыто unit-тестами — требует живой БД и .mbz файла. E2E-прогон на
// реальном экспорте PSR выполняется задачей C6.
const USAGE = `Использование: parta5-import --file <path.mbz> --school <slug> --user <email> [--dry-run] [--keep-temp]`;

const DRY_RUN_STORAGE: StorageAdapter = {
  async presignUpload() {
    throw new Error('dry-run: обращение к хранилищу не ожидается');
  },
  publicUrl() {
    throw new Error('dry-run: обращение к хранилищу не ожидается');
  },
  async delete() {
    throw new Error('dry-run: обращение к хранилищу не ожидается');
  },
  async headObject() {
    throw new Error('dry-run: обращение к хранилищу не ожидается');
  },
  async getObjectStream() {
    throw new Error('dry-run: обращение к хранилищу не ожидается');
  },
  async putObjectFromPath() {
    throw new Error('dry-run: обращение к хранилищу не ожидается');
  },
};

// `pnpm --filter <pkg> <script> -- <args>` forwards the literal `--` token
// into argv instead of stripping it, so a leading `--` must be dropped here.
function scriptArgs(): string[] {
  const raw = process.argv.slice(2);
  return raw[0] === '--' ? raw.slice(1) : raw;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: scriptArgs(),
    options: {
      file: { type: 'string' },
      school: { type: 'string' },
      user: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'keep-temp': { type: 'boolean', default: false },
    },
  });

  if (!values.file || !values.school || !values.user) {
    console.error(USAGE);
    process.exit(1);
    return;
  }

  const filePath = values.file;
  const schoolSlug = values.school;
  const userEmail = values.user;
  const dryRun = values['dry-run'] === true;
  const keepTemp = values['keep-temp'] === true;

  const school = await prisma.school.findUnique({ where: { slug: schoolSlug } });
  if (!school) {
    console.error(`Школа не найдена: slug=${schoolSlug}`);
    process.exit(1);
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    console.error(`Пользователь не найден: email=${userEmail}`);
    process.exit(1);
    return;
  }

  if (user.schoolId !== school.id) {
    console.error(`Пользователь ${userEmail} не принадлежит школе ${schoolSlug}`);
    process.exit(1);
    return;
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-import-'));

  try {
    await extractMbz(filePath, tmpDir);

    const storage = dryRun ? DRY_RUN_STORAGE : createStorageFromEnv();

    const report = await importCourse({
      backupDir: tmpDir,
      schoolId: school.id,
      createdById: user.id,
      storage,
      dryRun,
    });

    console.log(formatReport(report, dryRun));
  } finally {
    if (!keepTemp) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

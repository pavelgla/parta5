import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Job } from 'bullmq';
import { withTenant, type CourseImportStatus, type Prisma } from '@parta5/db';
import { createStorageFromEnv } from '@parta5/storage';
import { extractMbz, importCourse } from '@parta5/importer';
import { pino } from 'pino';

const log = pino({ name: 'import-course' });
const storage = createStorageFromEnv();

// Jobs run with attempts: 1 (see producer in import.ts) — re-running a
// finished import would create a duplicate course. This guard only protects
// against a job for an already-terminal import being manually re-enqueued.
const RESTARTABLE_STATUSES: CourseImportStatus[] = ['PENDING', 'RUNNING'];

export interface ImportCourseJob {
  courseImportId: string;
  schoolId: string;
}

export async function handleImportCourse(job: Job<ImportCourseJob>): Promise<void> {
  const { courseImportId, schoolId } = job.data;
  const tmpRoot = await mkdtemp(join(tmpdir(), `parta5-import-${courseImportId}-`));
  const extractDir = join(tmpRoot, 'extract');
  const mbzFile = join(tmpRoot, 'backup.mbz');

  try {
    const courseImport = await withTenant(schoolId, (tx) =>
      tx.courseImport.findFirstOrThrow({
        where: { id: courseImportId, schoolId },
        include: { fileAsset: true },
      }),
    );

    if (!RESTARTABLE_STATUSES.includes(courseImport.status)) {
      log.info(
        { courseImportId, status: courseImport.status },
        'Import already processed, skipping',
      );
      return;
    }

    await withTenant(schoolId, (tx) =>
      tx.courseImport.update({
        where: { id: courseImportId },
        data: { status: 'RUNNING' },
      }),
    );

    const stream = await storage.getObjectStream(courseImport.fileAsset.key);
    await pipeline(stream as NodeJS.ReadableStream, createWriteStream(mbzFile));

    await extractMbz(mbzFile, extractDir);

    const report = await importCourse({
      backupDir: extractDir,
      schoolId,
      createdById: courseImport.createdById,
      storage,
      dryRun: false,
    });

    const course = await withTenant(schoolId, (tx) =>
      tx.course.findFirst({ where: { schoolId, slug: report.courseSlug ?? undefined } }),
    );

    await withTenant(schoolId, (tx) =>
      tx.courseImport.update({
        where: { id: courseImportId },
        data: {
          status: 'DONE',
          report: report as unknown as Prisma.InputJsonValue,
          courseId: course?.id,
        },
      }),
    );

    log.info({ courseImportId, courseId: course?.id }, 'Import complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ courseImportId, err }, 'Import failed');
    await withTenant(schoolId, (tx) =>
      tx.courseImport.update({
        where: { id: courseImportId },
        data: { status: 'FAILED', error: message },
      }),
    );
    throw err;
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

import crypto from 'node:crypto';
import type { PrismaClient, Prisma } from '@parta5/db';
import { prisma as defaultPrisma, FileAssetStatus } from '@parta5/db';
import type { StorageAdapter } from '@parta5/storage';
import { buildKey } from '@parta5/storage';
import { parseManifest } from './manifest.js';
import { parseFilesManifest, contentPath, findCourseCoverFile } from './files.js';

export interface ImportCoverOnlyOptions {
  backupDir: string;
  schoolId: string;
  createdById: string;
  storage: StorageAdapter;
  db?: PrismaClient;
}

/**
 * Scoped to the given client (not the `@parta5/db` singleton) so callers can
 * inject a test double — mirrors `import-course.ts`'s own tenant helper.
 */
async function withTenantClient<T>(
  db: PrismaClient,
  schoolId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  });
}

interface CourseCandidate {
  id: string;
  title: string;
}

export type CoverOnlyResult =
  | { status: 'no-cover-in-backup'; courseFullname: string }
  | { status: 'no-course-match'; courseFullname: string }
  | { status: 'ambiguous-match'; courseFullname: string; candidates: CourseCandidate[] }
  | { status: 'already-has-cover'; courseId: string; courseTitle: string }
  | { status: 'cover-set'; courseId: string; courseTitle: string; fileAssetId: string };

/**
 * "Добор" обложек для уже импортированных курсов — не создаёт ничего, кроме
 * одного `FileAsset` и связи `Course.coverFileAssetId`. Курс ищется по
 * `fullname` бэкапа в пределах школы: при 0 или >1 совпадений ничего не
 * меняем и честно сообщаем кандидатов, а не гадаем.
 */
export async function importCoverOnly(opts: ImportCoverOnlyOptions): Promise<CoverOnlyResult> {
  const { backupDir, schoolId, createdById, storage } = opts;
  const db = opts.db ?? defaultPrisma;

  const manifest = await parseManifest(backupDir);
  const filesManifest = await parseFilesManifest(backupDir);
  const coverFile = findCourseCoverFile(filesManifest);

  if (!coverFile) {
    return { status: 'no-cover-in-backup', courseFullname: manifest.originalCourseFullname };
  }

  const candidates = await withTenantClient(db, schoolId, (tx) =>
    tx.course.findMany({
      where: { schoolId, title: manifest.originalCourseFullname },
      select: { id: true, title: true, coverFileAssetId: true },
    }),
  );

  if (candidates.length === 0) {
    return { status: 'no-course-match', courseFullname: manifest.originalCourseFullname };
  }
  if (candidates.length > 1) {
    return {
      status: 'ambiguous-match',
      courseFullname: manifest.originalCourseFullname,
      candidates: candidates.map((c) => ({ id: c.id, title: c.title })),
    };
  }

  const course = candidates[0];
  if (course.coverFileAssetId) {
    return { status: 'already-has-cover', courseId: course.id, courseTitle: course.title };
  }

  const uuid = crypto.randomUUID();
  const key = buildKey(schoolId, 'files', uuid, coverFile.filename);
  await storage.putObjectFromPath(
    key,
    contentPath(backupDir, coverFile.contenthash),
    coverFile.mimetype ?? 'application/octet-stream',
  );

  try {
    const fileAssetId = await withTenantClient(db, schoolId, async (tx) => {
      const fileAsset = await tx.fileAsset.create({
        data: {
          schoolId,
          uploaderId: createdById,
          key,
          originalName: coverFile.filename,
          mimeType: coverFile.mimetype ?? 'application/octet-stream',
          sizeBytes: coverFile.filesize,
          status: FileAssetStatus.UPLOADED,
        },
      });

      await tx.course.update({
        where: { id: course.id },
        data: { coverFileAssetId: fileAsset.id },
      });

      return fileAsset.id;
    });

    return {
      status: 'cover-set',
      courseId: course.id,
      courseTitle: course.title,
      fileAssetId,
    };
  } catch (err) {
    try {
      await storage.delete(key);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

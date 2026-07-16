import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import type { PrismaClient, Prisma } from '@parta5/db';
import { prisma as defaultPrisma, FileAssetStatus } from '@parta5/db';
import type { StorageAdapter } from '@parta5/storage';
import { buildKey } from '@parta5/storage';
import { parseManifest, type CourseManifest, type ManifestActivity } from './manifest.js';
import { parseSection } from './section.js';
import { parseFilesManifest, contentPath, type BackupFileEntry } from './files.js';
import { parsePage } from './activities/page.js';
import { parseLabel } from './activities/label.js';
import { parseResource } from './activities/resource.js';
import { parseUrl } from './activities/url.js';
import { parseQuiz } from './activities/quiz.js';
import { getActivityContextId } from './activities/context.js';
import { parseBackupQuestions } from './questions/backup-questions.js';
import type { ParsedQuestion, SkippedQuestion } from './questions/types.js';
import { slugify } from './translit.js';
import type { ImportReport, SkippedActivity } from './report.js';

const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'rutube.ru', 'vk.com', 'vkvideo.ru'];

interface MatchedQuizInstance {
  slot: number;
  maxmark: number;
  questionIndex: number;
}

type PlannedBlock =
  | { kind: 'TEXT'; html: string; text: string }
  | { kind: 'FILE'; file: BackupFileEntry; displayName: string; key?: string }
  | { kind: 'VIDEO_EMBED'; url: string }
  | {
      kind: 'QUIZ';
      quizName: string;
      introHtml: string | null;
      timelimit: number;
      attempts: number;
      matchedInstances: MatchedQuizInstance[];
    };

interface PlannedLesson {
  title: string;
  blocks: PlannedBlock[];
}

interface PlannedModule {
  title: string;
  order: number;
  lessons: PlannedLesson[];
}

interface ImportPlan {
  courseTitle: string;
  courseDescription: string | null;
  modules: PlannedModule[];
  skippedActivities: SkippedActivity[];
  warnings: string[];
  fileCount: number;
  fileTotalBytes: number;
  quizzes: number;
  parsedQuestions: ParsedQuestion[];
  skippedQuestions: SkippedQuestion[];
}

type ParsedQuestionsResult = Awaited<ReturnType<typeof parseBackupQuestions>>;

// Parsed lazily — only if the backup actually contains a quiz — and shared
// across every quiz activity in the backup so questions.xml is read once.
interface QuizContext {
  parsed: ParsedQuestionsResult | null;
  quizCount: number;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function isVideoUrl(externalurl: string): boolean {
  try {
    const host = new URL(externalurl).hostname.replace(/^www\./, '');
    return VIDEO_HOSTS.includes(host);
  } catch {
    return false;
  }
}

async function buildPlan(backupDir: string, manifest: CourseManifest): Promise<ImportPlan> {
  const filesManifest = await parseFilesManifest(backupDir);

  const warnings: string[] = [];
  const skippedActivities: SkippedActivity[] = [];
  let fileCount = 0;
  let fileTotalBytes = 0;
  const quizCtx: QuizContext = { parsed: null, quizCount: 0 };

  const sections = await Promise.all(
    manifest.sections.map((section) => parseSection(backupDir, section.directory)),
  );

  const modules: PlannedModule[] = [];

  for (const [index, manifestSection] of manifest.sections.entries()) {
    const section = sections[index];
    const activitiesInSection = manifest.activities.filter(
      (activity) => activity.sectionId === manifestSection.sectionId,
    );

    const orderedActivities = orderActivitiesBySequence(
      activitiesInSection,
      section.sequence,
      manifestSection.sectionId,
      warnings,
    );

    const lessons: PlannedLesson[] = [];

    for (const activity of orderedActivities) {
      const lesson = await buildLesson(backupDir, activity, filesManifest, warnings, quizCtx);
      if (lesson === null) {
        skippedActivities.push(skipReasonFor(activity));
        continue;
      }
      lessons.push(lesson.lesson);
      fileCount += lesson.fileCount;
      fileTotalBytes += lesson.fileTotalBytes;
    }

    modules.push({ title: manifestSection.title, order: index, lessons });
  }

  const firstSummary = sections[0]?.summaryHtml ?? null;

  return {
    courseTitle: manifest.originalCourseFullname,
    courseDescription: firstSummary,
    modules,
    skippedActivities,
    warnings,
    fileCount,
    fileTotalBytes,
    quizzes: quizCtx.quizCount,
    parsedQuestions: quizCtx.parsed?.questions ?? [],
    skippedQuestions: quizCtx.parsed?.skipped ?? [],
  };
}

function orderActivitiesBySequence(
  activities: ManifestActivity[],
  sequence: number[],
  sectionId: number,
  warnings: string[],
): ManifestActivity[] {
  const bySequence: ManifestActivity[] = [];
  const notInSequence: ManifestActivity[] = [];

  for (const activity of activities) {
    if (sequence.includes(activity.moduleId)) {
      bySequence.push(activity);
    } else {
      notInSequence.push(activity);
    }
  }

  bySequence.sort((a, b) => sequence.indexOf(a.moduleId) - sequence.indexOf(b.moduleId));

  for (const activity of notInSequence) {
    warnings.push(
      `Активность "${activity.title}" (moduleId ${activity.moduleId}) не найдена в sequence секции ${sectionId}, добавлена в конец`,
    );
  }

  return [...bySequence, ...notInSequence];
}

function skipReasonFor(activity: ManifestActivity): SkippedActivity {
  return {
    modulename: activity.modulename,
    title: activity.title,
    reason: `Неизвестный тип активности: ${activity.modulename}`,
  };
}

interface BuiltLesson {
  lesson: PlannedLesson;
  fileCount: number;
  fileTotalBytes: number;
}

async function buildLesson(
  backupDir: string,
  activity: ManifestActivity,
  filesManifest: BackupFileEntry[],
  warnings: string[],
  quizCtx: QuizContext,
): Promise<BuiltLesson | null> {
  if (activity.modulename === 'page') {
    const page = await parsePage(backupDir, activity.directory);
    const block: PlannedBlock = {
      kind: 'TEXT',
      html: page.contentHtml,
      text: stripTags(page.contentHtml),
    };
    return { lesson: { title: activity.title, blocks: [block] }, fileCount: 0, fileTotalBytes: 0 };
  }

  if (activity.modulename === 'label') {
    const label = await parseLabel(backupDir, activity.directory);
    const html = label.introHtml ?? '';
    const block: PlannedBlock = { kind: 'TEXT', html, text: stripTags(html) };
    return { lesson: { title: activity.title, blocks: [block] }, fileCount: 0, fileTotalBytes: 0 };
  }

  if (activity.modulename === 'resource') {
    const resource = await parseResource(backupDir, activity.directory);
    const contextId = await getActivityContextId(backupDir, activity.directory, 'resource');
    const files = filesManifest.filter(
      (entry) =>
        entry.component === 'mod_resource' &&
        entry.filearea === 'content' &&
        entry.contextid === contextId,
    );
    const blocks: PlannedBlock[] = files.map((file) => ({
      kind: 'FILE',
      file,
      displayName: resource.name,
    }));
    const fileTotalBytes = files.reduce((sum, file) => sum + file.filesize, 0);
    return {
      lesson: { title: activity.title, blocks },
      fileCount: files.length,
      fileTotalBytes,
    };
  }

  if (activity.modulename === 'url') {
    const url = await parseUrl(backupDir, activity.directory);
    const block: PlannedBlock = isVideoUrl(url.externalurl)
      ? { kind: 'VIDEO_EMBED', url: url.externalurl }
      : {
          kind: 'TEXT',
          html: `<p><a href="${url.externalurl}">${url.name}</a></p>`,
          text: url.name,
        };
    return { lesson: { title: activity.title, blocks: [block] }, fileCount: 0, fileTotalBytes: 0 };
  }

  if (activity.modulename === 'quiz') {
    if (quizCtx.parsed === null) {
      quizCtx.parsed = await parseBackupQuestions(backupDir);
      for (const skipped of quizCtx.parsed.skipped) {
        warnings.push(`вопрос ${skipped.name} пропущен: ${skipped.reason}`);
      }
      const withPluginFiles = quizCtx.parsed.questions.filter((q) => q.hasPluginFiles).length;
      if (withPluginFiles > 0) {
        warnings.push(
          `${withPluginFiles} вопрос(ов) содержат встроенные файлы (@@PLUGINFILE@@) — ` +
            `изображения и вложения внутри вопросов не переносятся в MVP`,
        );
      }
    }
    const { parsed } = quizCtx;

    const quiz = await parseQuiz(backupDir, activity.directory);
    const matchedInstances: MatchedQuizInstance[] = [];
    for (const instance of quiz.questionInstances) {
      const matched =
        instance.questionbankentryid !== undefined
          ? parsed.byEntryId.get(instance.questionbankentryid)
          : parsed.byId.get(instance.questionid!);
      if (matched === undefined) {
        warnings.push(
          `Квиз "${quiz.name}": вопрос для question_instance (slot ${instance.slot}) не найден, пропущен`,
        );
        continue;
      }
      matchedInstances.push({
        slot: instance.slot,
        maxmark: instance.maxmark,
        questionIndex: parsed.questions.indexOf(matched),
      });
    }

    quizCtx.quizCount += 1;
    const block: PlannedBlock = {
      kind: 'QUIZ',
      quizName: quiz.name,
      introHtml: quiz.introHtml,
      timelimit: quiz.timelimit,
      attempts: quiz.attempts,
      matchedInstances,
    };
    return { lesson: { title: activity.title, blocks: [block] }, fileCount: 0, fileTotalBytes: 0 };
  }

  return null;
}

function buildReport(plan: ImportPlan, courseSlug: string): ImportReport {
  const lessons = plan.modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
  const blocks = plan.modules.reduce(
    (sum, mod) => sum + mod.lessons.reduce((s, lesson) => s + lesson.blocks.length, 0),
    0,
  );

  const skippedByType: Record<string, number> = {};
  for (const skipped of plan.skippedQuestions) {
    skippedByType[skipped.moodleType] = (skippedByType[skipped.moodleType] ?? 0) + 1;
  }

  return {
    courseTitle: plan.courseTitle,
    courseSlug,
    modules: plan.modules.length,
    lessons,
    blocks,
    files: { count: plan.fileCount, totalBytes: plan.fileTotalBytes },
    skippedActivities: plan.skippedActivities,
    warnings: plan.warnings,
    quizzes: plan.quizzes,
    questions: { imported: plan.parsedQuestions.length, skippedByType },
  };
}

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

type NonQuizBlock = Exclude<PlannedBlock, { kind: 'QUIZ' }>;

function blockData(block: NonQuizBlock, fileAssetId?: string): Record<string, unknown> {
  if (block.kind === 'TEXT') return { html: block.html, text: block.text };
  if (block.kind === 'VIDEO_EMBED') return { url: block.url };
  return { fileAssetId, displayName: block.displayName };
}

function blockType(block: NonQuizBlock): 'TEXT' | 'FILE' | 'VIDEO_EMBED' {
  return block.kind;
}

export interface ImportCourseOptions {
  backupDir: string;
  schoolId: string;
  createdById: string;
  storage: StorageAdapter;
  dryRun: boolean;
  db?: PrismaClient;
}

export async function importCourse(opts: ImportCourseOptions): Promise<ImportReport> {
  const { backupDir, schoolId, createdById, storage, dryRun } = opts;
  const db = opts.db ?? defaultPrisma;

  const manifest = await parseManifest(backupDir);
  const plan = await buildPlan(backupDir, manifest);
  const courseSlug = `${slugify(manifest.originalCourseShortname)}-${nanoid(6)}`;

  if (dryRun) {
    return buildReport(plan, courseSlug);
  }

  const fileBlocks = plan.modules.flatMap((mod) =>
    mod.lessons.flatMap((lesson) => lesson.blocks.filter((block) => block.kind === 'FILE')),
  ) as Array<Extract<PlannedBlock, { kind: 'FILE' }>>;

  const uploadedKeys: string[] = [];
  for (const block of fileBlocks) {
    const uuid = crypto.randomUUID();
    const key = buildKey(schoolId, 'files', uuid, block.file.filename);
    await storage.putObjectFromPath(
      key,
      contentPath(backupDir, block.file.contenthash),
      block.file.mimetype ?? 'application/octet-stream',
    );
    block.key = key;
    uploadedKeys.push(key);
  }

  try {
    return await withTenantClient(db, schoolId, async (tx) => {
      const course = await tx.course.create({
        data: {
          schoolId,
          createdById,
          title: plan.courseTitle,
          description: plan.courseDescription ?? undefined,
          slug: courseSlug,
          status: 'DRAFT',
        },
      });

      const createdQuestionIds: string[] = [];
      if (plan.quizzes > 0) {
        const bank = await tx.questionBank.create({
          data: {
            schoolId,
            name: `Импорт: ${manifest.originalCourseShortname}`,
            createdById,
          },
        });

        for (const parsed of plan.parsedQuestions) {
          const question = await tx.question.create({
            data: {
              schoolId,
              bankId: bank.id,
              type: parsed.data.type,
              name: parsed.name,
              data: parsed.data as Prisma.InputJsonValue,
              version: 1,
              createdById,
            },
          });
          createdQuestionIds.push(question.id);
        }
      }

      for (const mod of plan.modules) {
        const createdModule = await tx.module.create({
          data: { schoolId, courseId: course.id, title: mod.title, order: mod.order },
        });

        for (const [lessonOrder, lesson] of mod.lessons.entries()) {
          const createdLesson = await tx.lesson.create({
            data: {
              schoolId,
              moduleId: createdModule.id,
              title: lesson.title,
              order: lessonOrder,
            },
          });

          for (const [blockOrder, block] of lesson.blocks.entries()) {
            if (block.kind === 'QUIZ') {
              const quiz = await tx.quiz.create({
                data: {
                  schoolId,
                  title: block.quizName,
                  description: block.introHtml ?? undefined,
                  timeLimitSeconds: block.timelimit > 0 ? block.timelimit : null,
                  maxAttempts: block.attempts > 0 ? block.attempts : null,
                  passingScore: null,
                  createdById,
                },
              });

              for (const instance of block.matchedInstances) {
                await tx.quizQuestion.create({
                  data: {
                    schoolId,
                    quizId: quiz.id,
                    questionId: createdQuestionIds[instance.questionIndex],
                    order: instance.slot,
                    points: instance.maxmark,
                  },
                });
              }

              await tx.contentBlock.create({
                data: {
                  schoolId,
                  lessonId: createdLesson.id,
                  type: 'QUIZ',
                  data: { quizId: quiz.id, title: block.quizName } as Prisma.InputJsonValue,
                  order: blockOrder,
                },
              });
              continue;
            }

            let fileAssetId: string | undefined;
            if (block.kind === 'FILE') {
              const fileAsset = await tx.fileAsset.create({
                data: {
                  schoolId,
                  uploaderId: createdById,
                  key: block.key!,
                  originalName: block.file.filename,
                  mimeType: block.file.mimetype ?? 'application/octet-stream',
                  sizeBytes: block.file.filesize,
                  status: FileAssetStatus.UPLOADED,
                },
              });
              fileAssetId = fileAsset.id;
            }

            await tx.contentBlock.create({
              data: {
                schoolId,
                lessonId: createdLesson.id,
                type: blockType(block),
                data: blockData(block, fileAssetId) as Prisma.InputJsonValue,
                order: blockOrder,
              },
            });
          }
        }
      }

      return buildReport(plan, courseSlug);
    });
  } catch (err) {
    for (const key of uploadedKeys) {
      try {
        await storage.delete(key);
      } catch {
        // best-effort cleanup
      }
    }
    throw err;
  }
}

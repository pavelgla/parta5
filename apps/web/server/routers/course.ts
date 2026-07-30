import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, type SchoolKind, type UserRole } from '@parta5/db';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { SUBJECT_IDS } from '@/lib/subjects';
import { logEvent } from '../services/learning-events';
import { assertCanEditCourse } from '../services/authz';
import { createWithUniqueSlug } from './course-slug';
import { validateCourse, type ValidationIssue } from './course-validation';

const courseWithModulesInclude = {
  modules: {
    orderBy: { order: 'asc' as const },
    include: {
      lessons: {
        orderBy: { order: 'asc' as const },
        include: { blocks: { select: { id: true } } },
      },
    },
  },
} as const;

type TransactionClient = Prisma.TransactionClient;

type PublishAttemptResult =
  | { ok: true; course: { id: string; title: string; status: string; publishedAt: Date | null } }
  | { ok: false; title: string; issues: ValidationIssue[] };

/**
 * Единственный путь перехода курса в PUBLISHED: проверка прав, валидация,
 * запись статуса + publishedAt. Используется и одиночной publish, и
 * массовой publishMany — переход статуса не должен дублироваться в двух
 * местах (см. правило: status меняется только через publish/unpublish/archive).
 */
async function attemptPublishCourse(
  tx: TransactionClient,
  params: { id: string; userId: string; role: UserRole; schoolKind: SchoolKind },
): Promise<PublishAttemptResult> {
  await assertCanEditCourse(tx, params.id, params.userId, params.role);
  const course = await tx.course.findUniqueOrThrow({
    where: { id: params.id },
    include: courseWithModulesInclude,
  });
  const issues = validateCourse(course, params.schoolKind);
  if (issues.length > 0) {
    return { ok: false, title: course.title, issues };
  }
  const updated = await tx.course.update({
    where: { id: params.id },
    data: {
      status: 'PUBLISHED',
      publishedAt: course.publishedAt ?? new Date(),
    },
  });
  return { ok: true, course: updated };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export const courseRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, (tx) =>
      tx.course.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          createdAt: true,
          subject: true,
          gradeLevel: true,
          shortDescription: true,
          coverFileAsset: { select: { id: true } },
        },
      }),
    );
  }),

  get: tenantProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, (tx) =>
      tx.course.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: { lessons: { orderBy: { order: 'asc' } } },
          },
          coverFileAsset: { select: { id: true } },
        },
      }),
    );
  }),

  create: teacherProcedure
    .input(z.object({ title: z.string().min(1).max(200), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const createdById = ctx.userId;
      const baseSlug = slugify(input.title) || 'course';
      return withTenant(schoolId, (tx) =>
        createWithUniqueSlug(baseSlug, (slug) =>
          tx.course.create({
            data: {
              title: input.title,
              description: input.description,
              schoolId,
              createdById,
              slug,
            },
          }),
        ),
      );
    }),

  update: teacherProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          title: z.string().min(1).max(200).optional(),
          description: z.string().optional(),
          // status здесь НЕ принимается: раньше через него можно было выставить
          // PUBLISHED в обход validateCourse и без publishedAt. Переходы статуса —
          // только publish/unpublish/archive.
          subject: z.enum(SUBJECT_IDS).optional().nullable(),
          gradeLevel: z.number().int().min(1).max(12).optional().nullable(),
          shortDescription: z.string().max(200).optional().nullable(),
          longDescription: z.record(z.string(), z.unknown()).optional().nullable(),
          coverFileAssetId: z.string().uuid().optional().nullable(),
          slug: z.string().min(1).max(100).optional(),
        })
        // strict, а не молчаливое отбрасывание: клиент, пытающийся выставить
        // status здесь, должен получить ошибку, а не успешный ответ и курс,
        // оставшийся в прежнем статусе.
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, id, ctx.userId, ctx.session.user.role);
        return tx.course.update({ where: { id }, data: data as Prisma.CourseUncheckedUpdateInput });
      });
    }),

  delete: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.id, ctx.userId, ctx.session.user.role);
        return tx.course.delete({ where: { id: input.id } });
      });
    }),

  validate: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const [course, school] = await Promise.all([
          tx.course.findUniqueOrThrow({
            where: { id: input.id },
            include: courseWithModulesInclude,
          }),
          tx.school.findUniqueOrThrow({ where: { id: schoolId }, select: { kind: true } }),
        ]);
        return validateCourse(course, school.kind);
      });
    }),

  publish: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const updated = await withTenant(schoolId, async (tx) => {
        const school = await tx.school.findUniqueOrThrow({
          where: { id: schoolId },
          select: { kind: true },
        });
        const result = await attemptPublishCourse(tx, {
          id: input.id,
          userId: ctx.userId,
          role: ctx.session.user.role,
          schoolKind: school.kind,
        });
        if (!result.ok) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: JSON.stringify(result.issues) });
        }
        return result.course;
      });
      void logEvent({
        schoolId,
        actorId: ctx.userId,
        verb: 'published',
        objectType: 'course',
        objectId: input.id,
      });
      return updated;
    }),

  // Массовая публикация (S13): импортёр создаёт курсы черновиками, и заполнять
  // «Краткое описание» вручную под сотню курсов нереально. Каждый курс проходит
  // ту же attemptPublishCourse, что и одиночный publish — невалидные просто
  // остаются в списке пропущенных с причинами, без частичных исключений/абортов
  // всей пачки на первой ошибке.
  publishMany: teacherProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const results = await withTenant(schoolId, async (tx) => {
        const school = await tx.school.findUniqueOrThrow({
          where: { id: schoolId },
          select: { kind: true },
        });
        const out: Array<{
          id: string;
          title: string;
          published: boolean;
          issues: ValidationIssue[];
        }> = [];
        for (const id of input.ids) {
          try {
            const result = await attemptPublishCourse(tx, {
              id,
              userId: ctx.userId,
              role: ctx.session.user.role,
              schoolKind: school.kind,
            });
            if (result.ok) {
              out.push({ id, title: result.course.title, published: true, issues: [] });
            } else {
              out.push({ id, title: result.title, published: false, issues: result.issues });
            }
          } catch (err) {
            // Курс не найден в этой школе или нет прав на него — тоже пропуск,
            // а не обрыв всей пачки: остальные валидные курсы должны опубликоваться.
            const message = err instanceof TRPCError ? err.message : 'Не удалось опубликовать курс';
            out.push({ id, title: '', published: false, issues: [{ path: 'access', message }] });
          }
        }
        return out;
      });

      const publishedIds = results.filter((r) => r.published).map((r) => r.id);
      for (const id of publishedIds) {
        void logEvent({
          schoolId,
          actorId: ctx.userId,
          verb: 'published',
          objectType: 'course',
          objectId: id,
        });
      }

      const skipped = results
        .filter((r) => !r.published)
        .map((r) => ({ id: r.id, title: r.title, issues: r.issues }));

      return {
        publishedCount: publishedIds.length,
        skippedCount: skipped.length,
        skipped,
      };
    }),

  unpublish: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const updated = await withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.id, ctx.userId, ctx.session.user.role);
        return tx.course.update({
          where: { id: input.id },
          data: { status: 'DRAFT' },
        });
      });
      void logEvent({
        schoolId,
        actorId: ctx.userId,
        verb: 'unpublished',
        objectType: 'course',
        objectId: input.id,
      });
      return updated;
    }),

  archive: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const updated = await withTenant(schoolId, async (tx) => {
        await assertCanEditCourse(tx, input.id, ctx.userId, ctx.session.user.role);
        return tx.course.update({
          where: { id: input.id },
          data: { status: 'ARCHIVED' },
        });
      });
      void logEvent({
        schoolId,
        actorId: ctx.userId,
        verb: 'archived',
        objectType: 'course',
        objectId: input.id,
      });
      return updated;
    }),
});

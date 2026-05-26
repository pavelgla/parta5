import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@parta5/db';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { SUBJECT_IDS } from '@/lib/subjects';
import { logEvent } from '../services/learning-events';

type ValidationIssue = { path: string; message: string };

type CourseForValidation = {
  title: string;
  shortDescription?: string | null;
  subject?: string | null;
  gradeLevel?: number | null;
  coverFileAssetId?: string | null;
  modules: Array<{
    id: string;
    title: string;
    lessons: Array<{
      id: string;
      title: string;
      blocks: Array<{ id: string }>;
    }>;
  }>;
};

function validateCourse(course: CourseForValidation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!course.title?.trim()) {
    issues.push({ path: 'title', message: 'Укажите название курса' });
  }
  if (!course.shortDescription?.trim()) {
    issues.push({ path: 'shortDescription', message: 'Краткое описание обязательно' });
  }
  if (!course.subject) {
    issues.push({ path: 'subject', message: 'Выберите предмет' });
  }
  if (!course.gradeLevel || course.gradeLevel < 5 || course.gradeLevel > 11) {
    issues.push({ path: 'gradeLevel', message: 'Укажите класс (5–11)' });
  }
  if (!course.coverFileAssetId) {
    issues.push({ path: 'cover', message: 'Загрузите обложку курса' });
  }
  if (course.modules.length === 0) {
    issues.push({ path: 'modules', message: 'Добавьте хотя бы один модуль' });
  }
  for (const mod of course.modules) {
    if (mod.lessons.length === 0) {
      issues.push({
        path: `module.${mod.id}.lessons`,
        message: `Модуль «${mod.title}» не содержит уроков`,
      });
    }
    for (const lesson of mod.lessons) {
      if (lesson.blocks.length === 0) {
        issues.push({
          path: `lesson.${lesson.id}.blocks`,
          message: `Урок «${lesson.title}» пустой`,
        });
      }
    }
  }

  return issues;
}

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

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export const courseRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.session.user.schoolId!;
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
          coverFileAsset: { select: { key: true } },
        },
      }),
    );
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) =>
        tx.course.findUniqueOrThrow({
          where: { id: input.id },
          include: {
            modules: {
              orderBy: { order: 'asc' },
              include: { lessons: { orderBy: { order: 'asc' } } },
            },
            coverFileAsset: { select: { id: true, key: true } },
          },
        }),
      );
    }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(200), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const createdById = ctx.session.user.id;
      const baseSlug = slugify(input.title) || 'course';
      return withTenant(schoolId, async (tx) => {
        const count = await tx.course.count({
          where: { schoolId, slug: { startsWith: baseSlug } },
        });
        const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
        return tx.course.create({
          data: { title: input.title, description: input.description, schoolId, createdById, slug },
        });
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
        subject: z.enum(SUBJECT_IDS).optional().nullable(),
        gradeLevel: z.number().int().min(1).max(12).optional().nullable(),
        shortDescription: z.string().max(200).optional().nullable(),
        longDescription: z.record(z.string(), z.unknown()).optional().nullable(),
        coverFileAssetId: z.string().uuid().optional().nullable(),
        slug: z.string().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) =>
        tx.course.update({ where: { id }, data: data as Prisma.CourseUncheckedUpdateInput }),
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.course.delete({ where: { id: input.id } }));
    }),

  validate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, async (tx) => {
        const course = await tx.course.findUniqueOrThrow({
          where: { id: input.id },
          include: courseWithModulesInclude,
        });
        return validateCourse(course);
      });
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const updated = await withTenant(schoolId, async (tx) => {
        const course = await tx.course.findUniqueOrThrow({
          where: { id: input.id },
          include: courseWithModulesInclude,
        });
        const issues = validateCourse(course);
        if (issues.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: JSON.stringify(issues) });
        }
        return tx.course.update({
          where: { id: input.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: course.publishedAt ?? new Date(),
          },
        });
      });
      void logEvent({
        schoolId,
        actorId: ctx.session.user.id,
        verb: 'published',
        objectType: 'course',
        objectId: input.id,
      });
      return updated;
    }),

  unpublish: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const updated = await withTenant(schoolId, (tx) =>
        tx.course.update({
          where: { id: input.id },
          data: { status: 'DRAFT' },
        }),
      );
      void logEvent({
        schoolId,
        actorId: ctx.session.user.id,
        verb: 'unpublished',
        objectType: 'course',
        objectId: input.id,
      });
      return updated;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      const updated = await withTenant(schoolId, (tx) =>
        tx.course.update({
          where: { id: input.id },
          data: { status: 'ARCHIVED' },
        }),
      );
      void logEvent({
        schoolId,
        actorId: ctx.session.user.id,
        verb: 'archived',
        objectType: 'course',
        objectId: input.id,
      });
      return updated;
    }),
});

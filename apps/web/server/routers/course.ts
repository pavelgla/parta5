import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@parta5/db';
import { router, tenantProcedure, teacherProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { SUBJECT_IDS } from '@/lib/subjects';
import { logEvent } from '../services/learning-events';
import { assertCanEditCourse } from '../services/authz';
import { createWithUniqueSlug } from './course-slug';
import { validateCourse } from './course-validation';

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
        await assertCanEditCourse(tx, input.id, ctx.userId, ctx.session.user.role);
        const [course, school] = await Promise.all([
          tx.course.findUniqueOrThrow({
            where: { id: input.id },
            include: courseWithModulesInclude,
          }),
          tx.school.findUniqueOrThrow({ where: { id: schoolId }, select: { kind: true } }),
        ]);
        const issues = validateCourse(course, school.kind);
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
        actorId: ctx.userId,
        verb: 'published',
        objectType: 'course',
        objectId: input.id,
      });
      return updated;
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

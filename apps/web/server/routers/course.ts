import { z } from 'zod';
import { Prisma } from '@parta5/db';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';
import { SUBJECT_IDS } from '@/lib/subjects';

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
          coverFileAssetId: true,
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
        longDescription: z.unknown().optional().nullable(),
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
});

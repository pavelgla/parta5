import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';

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
        select: { id: true, title: true, slug: true, status: true, createdAt: true },
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.course.update({ where: { id }, data }));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.session.user.schoolId!;
      return withTenant(schoolId, (tx) => tx.course.delete({ where: { id: input.id } }));
    }),
});

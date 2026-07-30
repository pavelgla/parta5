import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@parta5/db';
import { router, publicProcedure } from '../trpc/init';
import { getSchoolIdForPublicRequest } from '@/lib/school-context';

const catalogListInput = z
  .object({
    query: z.string().trim().max(100).optional(),
    limit: z.number().int().min(1).max(60).optional(),
  })
  .optional();

interface ModuleWithLessons {
  lessons: { id: string }[];
}

/**
 * Only modules with at least one lesson count as "real" ones — the same
 * filter `learn.getCourse` applies for the student-facing course page, so
 * the storefront doesn't advertise empty sections left over from a Moodle
 * import that hasn't finished.
 */
function countNonEmptyModulesAndLessons(modules: ModuleWithLessons[]): {
  moduleCount: number;
  lessonCount: number;
} {
  const nonEmpty = modules.filter((mod) => mod.lessons.length > 0);
  return {
    moduleCount: nonEmpty.length,
    lessonCount: nonEmpty.reduce((sum, mod) => sum + mod.lessons.length, 0),
  };
}

export const catalogRouter = router({
  /**
   * Public course catalogue for the current school (resolved from the
   * request host, see `getSchoolIdForPublicRequest`). No session required —
   * this powers the anonymous `/` and `/catalog` pages.
   */
  list: publicProcedure.input(catalogListInput).query(async ({ input }) => {
    const schoolId = await getSchoolIdForPublicRequest();
    if (!schoolId) {
      return { items: [], total: 0 };
    }

    const query = input?.query;
    const limit = input?.limit;

    return withTenant(schoolId, async (tx) => {
      const where = {
        status: 'PUBLISHED' as const,
        ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}),
      };

      const [rows, total] = await Promise.all([
        tx.course.findMany({
          where,
          orderBy: { title: 'asc' },
          take: limit,
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            shortDescription: true,
            coverFileAsset: { select: { id: true } },
            modules: { select: { lessons: { select: { id: true } } } },
          },
        }),
        tx.course.count({ where }),
      ]);

      const items = rows.map(({ modules, ...course }) => ({
        ...course,
        ...countNonEmptyModulesAndLessons(modules),
      }));

      return { items, total };
    });
  }),

  getCourse: publicProcedure
    .input(z.object({ courseId: z.string().uuid() }))
    .query(async ({ input }) => {
      const schoolId = await getSchoolIdForPublicRequest();
      if (!schoolId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // RLS (via withTenant) already scopes this to the resolved school, so
      // a course belonging to a different school never matches here even
      // though we only filter by id + status below.
      const course = await withTenant(schoolId, (tx) =>
        tx.course.findFirst({
          where: { id: input.courseId, status: 'PUBLISHED' },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            shortDescription: true,
            coverFileAsset: { select: { id: true } },
            modules: {
              orderBy: { order: 'asc' },
              select: { id: true, title: true, lessons: { select: { id: true } } },
            },
          },
        }),
      );

      if (!course) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return {
        ...course,
        modules: course.modules
          .filter((mod) => mod.lessons.length > 0)
          .map((mod) => ({ id: mod.id, title: mod.title, lessonCount: mod.lessons.length })),
      };
    }),
});

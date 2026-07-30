import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Session } from 'next-auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

type FakeCourse = {
  id: string;
  title: string;
  status: string;
  publishedAt: Date | null;
  createdById: string;
  shortDescription: string | null;
  subject: string | null;
  gradeLevel: number | null;
  coverFileAssetId: string | null;
  modules: Array<{
    id: string;
    title: string;
    lessons: Array<{ id: string; title: string; blocks: Array<{ id: string }> }>;
  }>;
};

// vi.mock('@parta5/db', ...) is hoisted above these imports/consts, so everything
// the factory needs must live inside vi.hoisted() to avoid "Cannot access before
// initialization".
const { SCHOOL_KIND, USER_ROLE, courses, courseUpdateMock } = vi.hoisted(() => {
  const SCHOOL_KIND = {
    SCHOOL: 'SCHOOL',
    SUPPLEMENTARY: 'SUPPLEMENTARY',
    VOCATIONAL: 'VOCATIONAL',
  };
  const USER_ROLE = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    SCHOOL_ADMIN: 'SCHOOL_ADMIN',
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT',
    PARENT: 'PARENT',
  };
  const courses = new Map<string, FakeCourse>();
  const courseUpdateMock = vi.fn(
    async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const existing = courses.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data } as FakeCourse;
      courses.set(where.id, updated);
      return updated;
    },
  );
  return { SCHOOL_KIND, USER_ROLE, courses, courseUpdateMock };
});

function seedCourse(course: FakeCourse) {
  courses.set(course.id, { ...course });
}

vi.mock('@parta5/db', () => ({
  UserRole: USER_ROLE,
  SchoolKind: SCHOOL_KIND,
  Prisma: {},
  withTenant: (_schoolId: string, fn: (tx: unknown) => unknown) =>
    fn({
      school: {
        findUniqueOrThrow: vi.fn(async () => ({ kind: SCHOOL_KIND.VOCATIONAL })),
      },
      course: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const c = courses.get(where.id);
          if (!c) return null;
          return { id: c.id, createdById: c.createdById };
        }),
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
          const c = courses.get(where.id);
          if (!c) throw new Error('not found');
          return c;
        }),
        update: courseUpdateMock,
      },
      learningEvent: { create: vi.fn(async () => ({})) },
    }),
}));

import { courseRouter } from '../server/routers/course';
import { createCallerFactory, type Context } from '../server/trpc/init';

const createCaller = createCallerFactory(courseRouter);

function caller() {
  const session = {
    user: { id: 'teacher-1', role: 'TEACHER', schoolId: 'school-1' },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as Session;
  return createCaller({ session } as Context);
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

describe('course.publishMany', () => {
  beforeEach(() => {
    courses.clear();
    courseUpdateMock.mockClear();
  });

  it('публикует валидные курсы и пропускает невалидные с причинами, не прерывая пачку', async () => {
    const validId = uuid(1);
    const emptyId = uuid(2);

    seedCourse({
      id: validId,
      title: 'Курс вождения',
      status: 'DRAFT',
      publishedAt: null,
      createdById: 'teacher-1',
      shortDescription: null,
      subject: null,
      gradeLevel: null,
      coverFileAssetId: null,
      modules: [
        {
          id: 'mod-1',
          title: 'Модуль 1',
          lessons: [{ id: 'lesson-1', title: 'Урок 1', blocks: [{ id: 'block-1' }] }],
        },
      ],
    });

    seedCourse({
      id: emptyId,
      title: 'Пустой курс',
      status: 'DRAFT',
      publishedAt: null,
      createdById: 'teacher-1',
      shortDescription: null,
      subject: null,
      gradeLevel: null,
      coverFileAssetId: null,
      modules: [],
    });

    const result = await caller().publishMany({ ids: [validId, emptyId] });

    expect(result.publishedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.skipped).toEqual([
      {
        id: emptyId,
        title: 'Пустой курс',
        issues: [{ path: 'modules', message: 'Добавьте хотя бы один модуль' }],
      },
    ]);
    expect(courses.get(validId)?.status).toBe('PUBLISHED');
    expect(courses.get(emptyId)?.status).toBe('DRAFT');
  });

  it('пропускает чужой курс с причиной доступа, не прерывая обработку остальных', async () => {
    const foreignId = uuid(3);
    const ownId = uuid(4);

    seedCourse({
      id: foreignId,
      title: 'Чужой курс',
      status: 'DRAFT',
      publishedAt: null,
      createdById: 'another-teacher',
      shortDescription: null,
      subject: null,
      gradeLevel: null,
      coverFileAssetId: null,
      modules: [
        {
          id: 'mod-1',
          title: 'Модуль 1',
          lessons: [{ id: 'lesson-1', title: 'Урок 1', blocks: [{ id: 'block-1' }] }],
        },
      ],
    });

    seedCourse({
      id: ownId,
      title: 'Свой курс',
      status: 'DRAFT',
      publishedAt: null,
      createdById: 'teacher-1',
      shortDescription: null,
      subject: null,
      gradeLevel: null,
      coverFileAssetId: null,
      modules: [
        {
          id: 'mod-1',
          title: 'Модуль 1',
          lessons: [{ id: 'lesson-1', title: 'Урок 1', blocks: [{ id: 'block-1' }] }],
        },
      ],
    });

    const result = await caller().publishMany({ ids: [foreignId, ownId] });

    expect(result.publishedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.skipped[0]?.id).toBe(foreignId);
    expect(result.skipped[0]?.issues[0]?.path).toBe('access');
    expect(courses.get(ownId)?.status).toBe('PUBLISHED');
  });
});

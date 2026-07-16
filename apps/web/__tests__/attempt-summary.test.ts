import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { Session } from 'next-auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const quizFindUniqueMock = vi.fn();
const attemptCountMock = vi.fn();
const attemptFindFirstMock = vi.fn();
const contentBlockFindManyMock = vi.fn();
const enrollmentFindFirstMock = vi.fn();

vi.mock('@parta5/db', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    SCHOOL_ADMIN: 'SCHOOL_ADMIN',
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT',
    PARENT: 'PARENT',
  },
  withTenant: (_schoolId: string, fn: (tx: unknown) => unknown) =>
    fn({
      quiz: { findUnique: quizFindUniqueMock },
      quizAttempt: { count: attemptCountMock, findFirst: attemptFindFirstMock },
      contentBlock: { findMany: contentBlockFindManyMock },
      enrollment: { findFirst: enrollmentFindFirstMock },
    }),
}));

import { attemptRouter } from '../server/routers/attempt';
import { createCallerFactory, type Context } from '../server/trpc/init';

const createCaller = createCallerFactory(attemptRouter);
const quizId = '123e4567-e89b-12d3-a456-426614174000';

function sessionFor(role: string): Session {
  return {
    user: { id: 'user-1', role, schoolId: 'school-1' },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as Session;
}

function caller(role = 'STUDENT') {
  return createCaller({ session: sessionFor(role) } as Context);
}

describe('attempt.summary', () => {
  beforeEach(() => {
    quizFindUniqueMock.mockReset();
    attemptCountMock.mockReset();
    attemptFindFirstMock.mockReset();
    contentBlockFindManyMock.mockReset();
    enrollmentFindFirstMock.mockReset();
  });

  it('throws NOT_FOUND when the quiz does not exist', async () => {
    quizFindUniqueMock.mockResolvedValue(null);

    await expect(caller().summary({ quizId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<TRPCError>);
    expect(attemptCountMock).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN for a student not enrolled in any course with this quiz', async () => {
    quizFindUniqueMock.mockResolvedValue({ maxAttempts: 3 });
    contentBlockFindManyMock.mockResolvedValue([]);

    await expect(caller().summary({ quizId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });

  it('returns attemptsUsed, maxAttempts and lastScore for a finished attempt', async () => {
    quizFindUniqueMock.mockResolvedValue({ maxAttempts: 3 });
    contentBlockFindManyMock.mockResolvedValue([{ lesson: { module: { courseId: 'course-1' } } }]);
    enrollmentFindFirstMock.mockResolvedValue({ id: 'enrollment-1' });
    attemptCountMock.mockResolvedValue(2);
    attemptFindFirstMock.mockResolvedValue({ score: 4, maxScore: 5 });

    const result = await caller().summary({ quizId });

    expect(result).toEqual({
      attemptsUsed: 2,
      maxAttempts: 3,
      lastScore: { score: 4, maxScore: 5 },
    });
  });

  it('returns a null lastScore when the student has no finished attempts yet', async () => {
    quizFindUniqueMock.mockResolvedValue({ maxAttempts: null });
    contentBlockFindManyMock.mockResolvedValue([{ lesson: { module: { courseId: 'course-1' } } }]);
    enrollmentFindFirstMock.mockResolvedValue({ id: 'enrollment-1' });
    attemptCountMock.mockResolvedValue(0);
    attemptFindFirstMock.mockResolvedValue(null);

    const result = await caller().summary({ quizId });

    expect(result).toEqual({ attemptsUsed: 0, maxAttempts: null, lastScore: null });
  });

  it('bypasses enrollment checks for teacher roles', async () => {
    quizFindUniqueMock.mockResolvedValue({ maxAttempts: null });
    attemptCountMock.mockResolvedValue(0);
    attemptFindFirstMock.mockResolvedValue(null);

    const result = await caller('TEACHER').summary({ quizId });

    expect(contentBlockFindManyMock).not.toHaveBeenCalled();
    expect(enrollmentFindFirstMock).not.toHaveBeenCalled();
    expect(result).toEqual({ attemptsUsed: 0, maxAttempts: null, lastScore: null });
  });
});

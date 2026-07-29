import { describe, it, expect, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@parta5/db';
import type { Session } from 'next-auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { appRouter } from '../server/routers';
import { createCallerFactory, type Context } from '../server/trpc/init';

const createCaller = createCallerFactory(appRouter);

function sessionFor(role: UserRole, schoolId: string | null = 'school-1'): Session {
  return {
    user: { id: 'user-1', role, schoolId },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as Session;
}

function callerFor(session: Session | null) {
  return createCaller({ session } as Context);
}

describe('authz middleware', () => {
  it('null session → course.list throws UNAUTHORIZED', async () => {
    const caller = callerFor(null);
    await expect(caller.course.list()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    } satisfies Partial<TRPCError>);
  });

  it('STUDENT → course.create throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.STUDENT));
    await expect(caller.course.create({ title: 'Course' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });

  it('STUDENT → course.delete throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.STUDENT));
    await expect(
      caller.course.delete({ id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<TRPCError>);
  });

  it('STUDENT → block.create throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.STUDENT));
    await expect(
      caller.block.create({
        lessonId: '00000000-0000-0000-0000-000000000000',
        type: 'HEADING',
        data: {},
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<TRPCError>);
  });

  it('STUDENT → events.recent throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.STUDENT));
    await expect(caller.events.recent({ limit: 10 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });

  it.each([UserRole.STUDENT, UserRole.TEACHER, UserRole.SCHOOL_ADMIN])(
    '%s with schoolId: null → course.list throws UNAUTHORIZED',
    async (role) => {
      const caller = callerFor(sessionFor(role, null));
      await expect(caller.course.list()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      } satisfies Partial<TRPCError>);
    },
  );

  it('STUDENT → user.create throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.STUDENT));
    await expect(
      caller.user.create({
        name: 'New User',
        email: 'new@school.ru',
        role: UserRole.STUDENT,
        password: 'password123',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<TRPCError>);
  });

  it('TEACHER → user.create throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.TEACHER));
    await expect(
      caller.user.create({
        name: 'New User',
        email: 'new@school.ru',
        role: UserRole.STUDENT,
        password: 'password123',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<TRPCError>);
  });

  it('STUDENT → group.create throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.STUDENT));
    await expect(caller.group.create({ name: '10A' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });

  it('STUDENT → enrollment.enrollUsers throws FORBIDDEN', async () => {
    const caller = callerFor(sessionFor(UserRole.STUDENT));
    await expect(
      caller.enrollment.enrollUsers({
        courseId: '00000000-0000-0000-0000-000000000000',
        userIds: ['00000000-0000-0000-0000-000000000001'],
        role: 'STUDENT',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<TRPCError>);
  });

  it('SCHOOL_ADMIN → user.setActive on self throws BAD_REQUEST', async () => {
    const caller = callerFor(sessionFor(UserRole.SCHOOL_ADMIN));
    await expect(caller.user.setActive({ id: 'user-1', isActive: false })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });
});

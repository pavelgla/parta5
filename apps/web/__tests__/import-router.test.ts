import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { Session } from 'next-auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const findFirstMock = vi.fn();
const createMock = vi.fn();

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
      fileAsset: { findFirst: findFirstMock },
      courseImport: { create: createMock },
    }),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: vi.fn() })),
}));

import { importRouter } from '../server/routers/import';
import { createCallerFactory, type Context } from '../server/trpc/init';

const createCaller = createCallerFactory(importRouter);

function sessionFor(): Session {
  return {
    user: { id: 'user-1', role: 'TEACHER', schoolId: 'school-1' },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as Session;
}

function caller() {
  return createCaller({ session: sessionFor() } as Context);
}

describe('import.create', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    createMock.mockReset();
  });

  it('rejects a file asset with a disallowed MIME type', async () => {
    findFirstMock.mockResolvedValue({
      id: 'file-1',
      schoolId: 'school-1',
      mimeType: 'image/png',
    });

    await expect(
      caller().create({ fileAssetId: '123e4567-e89b-12d3-a456-426614174000' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' } satisfies Partial<TRPCError>);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for a file asset belonging to another school', async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(
      caller().create({ fileAssetId: '123e4567-e89b-12d3-a456-426614174001' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' } satisfies Partial<TRPCError>);

    expect(createMock).not.toHaveBeenCalled();
  });
});

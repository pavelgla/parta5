import { describe, it, expect, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@parta5/db';
import { createWithUniqueSlug } from '../server/routers/course-slug';

function slugConflictError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

describe('createWithUniqueSlug', () => {
  it('creates with the base slug on first success', async () => {
    const attemptCreate = vi.fn(async (slug: string) => ({ slug }));

    const result = await createWithUniqueSlug('my-course', attemptCreate);

    expect(result).toEqual({ slug: 'my-course' });
    expect(attemptCreate).toHaveBeenCalledTimes(1);
    expect(attemptCreate).toHaveBeenCalledWith('my-course');
  });

  it('retries with a random suffixed slug on a unique constraint violation', async () => {
    const attemptCreate = vi
      .fn()
      .mockRejectedValueOnce(slugConflictError())
      .mockImplementationOnce(async (slug: string) => ({ slug }));

    const result = await createWithUniqueSlug('my-course', attemptCreate);

    expect(attemptCreate).toHaveBeenCalledTimes(2);
    const secondSlug = attemptCreate.mock.calls[1][0] as string;
    expect(secondSlug).toMatch(/^my-course-[a-z0-9]{6}$/);
    expect(result).toEqual({ slug: secondSlug });
  });

  it('gives up after 3 attempts and throws a CONFLICT TRPCError', async () => {
    const attemptCreate = vi.fn(async () => {
      throw slugConflictError();
    });

    await expect(createWithUniqueSlug('my-course', attemptCreate)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(createWithUniqueSlug('my-course', attemptCreate)).rejects.toBeInstanceOf(
      TRPCError,
    );
    expect(attemptCreate).toHaveBeenCalledTimes(6);
  });

  it('rethrows non-conflict errors immediately without retrying', async () => {
    const boom = new Error('db is down');
    const attemptCreate = vi.fn(async () => {
      throw boom;
    });

    await expect(createWithUniqueSlug('my-course', attemptCreate)).rejects.toBe(boom);
    expect(attemptCreate).toHaveBeenCalledTimes(1);
  });
});

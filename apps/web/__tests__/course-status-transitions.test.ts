import { describe, it, expect, vi } from 'vitest';
import { UserRole } from '@parta5/db';
import type { Session } from 'next-auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { appRouter } from '../server/routers';
import { createCallerFactory, type Context } from '../server/trpc/init';

const createCaller = createCallerFactory(appRouter);

function teacherCaller() {
  const session = {
    user: { id: 'user-1', role: UserRole.TEACHER, schoolId: 'school-1' },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as Session;
  return createCaller({ session } as Context);
}

/**
 * Регрессия: course.update принимал status и писал его прямо в БД — PUBLISHED
 * можно было выставить в обход validateCourse и без publishedAt (курс без
 * описания и обложки «публиковался» выпадающим списком в форме редактирования).
 * Переходы статуса допустимы только через publish/unpublish/archive.
 */
describe('course.update не управляет статусом', () => {
  const validId = '00000000-0000-4000-8000-000000000000';

  it('отклоняет status в инпуте, не доходя до БД', async () => {
    const caller = teacherCaller();

    // Инпут отбраковывается zod'ом раньше любых обращений к Prisma,
    // поэтому мок БД не нужен: доходит сюда — значит дыра открыта.
    await expect(
      caller.course.update({ id: validId, title: 'Курс', status: 'PUBLISHED' } as never),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('publish/unpublish/archive доступны как отдельные процедуры', () => {
    const caller = teacherCaller();

    expect(typeof caller.course.publish).toBe('function');
    expect(typeof caller.course.unpublish).toBe('function');
    expect(typeof caller.course.archive).toBe('function');
  });
});

import Link from 'next/link';
import type { Route } from 'next';
import { auth, signOut } from '@/auth';
import { UserRole } from '@parta5/db';
import { getCurrentSchool } from '@/lib/school-context';
import { getFileUrl } from '@/lib/file-url';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];
const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export async function SiteHeader() {
  const [session, school] = await Promise.all([auth(), getCurrentSchool()]);
  const isTeacher = !!session?.user && TEACHER_ROLES.includes(session.user.role);
  const isAdmin = !!session?.user && ADMIN_ROLES.includes(session.user.role);
  const schoolLabel = school?.displayName ?? school?.name ?? null;

  return (
    <header className="border-b border-gray-200 bg-white">
      {/* Thin brand-color stripe — brands the header without recoloring the whole UI. */}
      <div className="h-[3px] bg-[var(--brand)]" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center">
            {school?.logoFileAssetId ? (
              <img
                src={getFileUrl({ id: school.logoFileAssetId })}
                alt={schoolLabel ?? 'Логотип'}
                className="h-9 w-auto"
              />
            ) : (
              <span className="text-xl font-bold text-[var(--brand)]">
                {schoolLabel ?? 'парта5'}
              </span>
            )}
          </Link>
          {isTeacher && (
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
              <Link
                href="/courses"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Курсы
              </Link>
              <Link
                href="/banks"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Банки вопросов
              </Link>
              <Link
                href="/quizzes"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Тесты
              </Link>
              {isAdmin && (
                <Link
                  href="/admin/users"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Пользователи
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin/settings"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Настройки
                </Link>
              )}
            </nav>
          )}
        </div>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-4">
          {session?.user ? (
            <>
              <span className="hidden max-w-[160px] truncate text-sm text-gray-600 sm:inline">
                {session.user.name}
              </span>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Выйти
                </button>
              </form>
            </>
          ) : (
            <>
              {/* /catalog is built by another task; the route type doesn't exist
                  yet, hence the explicit cast (same pattern as course-card.tsx). */}
              <Link
                href={'/catalog' as Route}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Каталог курсов
              </Link>
              <Link
                href="/login"
                className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
              >
                Войти
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

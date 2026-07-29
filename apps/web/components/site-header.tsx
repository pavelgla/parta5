import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { UserRole } from '@parta5/db';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];
const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export async function SiteHeader() {
  const session = await auth();
  const isTeacher = !!session?.user && TEACHER_ROLES.includes(session.user.role);
  const isAdmin = !!session?.user && ADMIN_ROLES.includes(session.user.role);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-6">
          <Link href="/" className="shrink-0 text-xl font-bold text-blue-600">
            парта5
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
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Войти
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

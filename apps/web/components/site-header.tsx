import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { UserRole } from '@parta5/db';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export async function SiteHeader() {
  const session = await auth();
  const isTeacher = !!session?.user && TEACHER_ROLES.includes(session.user.role);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-blue-600">
            парта5
          </Link>
          {isTeacher && (
            <nav className="flex items-center gap-4">
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
            </nav>
          )}
        </div>
        <nav className="flex items-center gap-4">
          {session?.user ? (
            <>
              <span className="text-sm text-gray-600">{session.user.name}</span>
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

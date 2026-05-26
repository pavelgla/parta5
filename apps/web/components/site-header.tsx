import Link from 'next/link';
import { auth, signOut } from '@/auth';

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-blue-600">
          парта5
        </Link>
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

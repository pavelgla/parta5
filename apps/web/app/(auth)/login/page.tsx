import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentSchool } from '@/lib/school-context';
import { getFileUrl } from '@/lib/file-url';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const school = await getCurrentSchool();
  const schoolLabel = school?.displayName ?? school?.name ?? null;

  async function login(formData: FormData) {
    'use server';
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: '/courses',
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect('/login?error=invalid_credentials');
      }
      throw error; // re-throw NEXT_REDIRECT and other non-auth errors
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--brand)]/5 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {school?.logoFileAssetId ? (
            <img
              src={getFileUrl({ id: school.logoFileAssetId })}
              alt={schoolLabel ?? 'Логотип'}
              className="h-12 w-auto"
            />
          ) : (
            <span className="text-xl font-bold text-[var(--brand)]">{schoolLabel ?? 'парта5'}</span>
          )}
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">Вход в систему</h1>
          {error === 'invalid_credentials' && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              Неверный email или пароль
            </p>
          )}
          <form action={login} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--brand)] py-2 text-sm font-medium text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
            >
              Войти
            </button>
          </form>
        </div>

        {/* On a school's own storefront, offering to register a *different*
            school makes no sense — only show this when no school resolved. */}
        {!school && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Нет школы?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline">
              Зарегистрировать
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

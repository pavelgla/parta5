import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma, SchoolKind } from '@parta5/db';
import bcrypt from 'bcryptjs';
import Link from 'next/link';

const SCHOOL_KIND_OPTIONS: Array<{ value: SchoolKind; label: string }> = [
  { value: SchoolKind.SCHOOL, label: 'Общеобразовательная школа (5–11 класс)' },
  { value: SchoolKind.SUPPLEMENTARY, label: 'Учреждение дополнительного образования' },
  { value: SchoolKind.VOCATIONAL, label: 'Учебный центр, ДПО, профобучение' },
];

function isSchoolKind(value: unknown): value is SchoolKind {
  return typeof value === 'string' && (Object.values(SchoolKind) as string[]).includes(value);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function signup(formData: FormData) {
    'use server';
    const schoolName = formData.get('schoolName') as string;
    const schoolSlug = formData.get('schoolSlug') as string;
    const schoolKind = formData.get('schoolKind');
    const adminName = formData.get('adminName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!isSchoolKind(schoolKind)) {
      redirect('/signup?error=invalid_kind');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const school = await prisma.school.create({
      data: { name: schoolName, slug: schoolSlug, kind: schoolKind },
    });

    await prisma.user.create({
      data: {
        email,
        hashedPassword,
        name: adminName,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });

    try {
      await signIn('credentials', { email, password, redirectTo: '/courses' });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect('/signup?error=signin_failed');
      }
      throw error;
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Регистрация школы</h1>
        {error === 'invalid_kind' && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Выберите тип организации
          </p>
        )}
        {error === 'signin_failed' && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Не удалось войти после регистрации, попробуйте войти вручную
          </p>
        )}
        <form action={signup} className="space-y-4">
          <div>
            <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700">
              Название школы
            </label>
            <input
              id="schoolName"
              name="schoolName"
              type="text"
              required
              placeholder="МБОУ СОШ №5"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="schoolSlug" className="block text-sm font-medium text-gray-700">
              Короткий адрес (латиница)
            </label>
            <input
              id="schoolSlug"
              name="schoolSlug"
              type="text"
              required
              placeholder="school-5-ptz"
              pattern="[a-z0-9-]+"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="schoolKind" className="block text-sm font-medium text-gray-700">
              Тип организации
            </label>
            <select
              id="schoolKind"
              name="schoolKind"
              required
              defaultValue=""
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                Выберите тип организации
              </option>
              {SCHOOL_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              От типа зависят обязательные поля курса: предмет и класс требуются только у школ.
            </p>
          </div>
          <div>
            <label htmlFor="adminName" className="block text-sm font-medium text-gray-700">
              Ваше имя
            </label>
            <input
              id="adminName"
              name="adminName"
              type="text"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
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
              minLength={8}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Зарегистрировать
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

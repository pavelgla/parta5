import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { ImportCourseForm } from './import-course-form';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function ImportCoursePage() {
  const session = await auth();
  if (!session) redirect('/login');

  if (!TEACHER_ROLES.includes(session.user.role)) {
    redirect('/courses');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/courses" className="text-sm text-gray-500 hover:text-gray-900">
          ← Курсы
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Импорт из Moodle</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm text-gray-500">
          Загрузите файл резервной копии курса Moodle (.mbz). Импорт выполняется в фоне — это может
          занять несколько минут.
        </p>
        <ImportCourseForm />
      </div>
    </div>
  );
}

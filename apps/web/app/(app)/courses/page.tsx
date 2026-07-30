import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { CoursesList } from './courses-list';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function CoursesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  // Управление курсами — только для преподавательских ролей: список здесь включает
  // черновики. Ученику показываем его учебный кабинет.
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const caller = await serverCaller();
  const courses = await caller.course.list();
  const isTeacher = TEACHER_ROLES.includes(session.user.role);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Курсы</h1>
        {isTeacher && (
          <div className="flex gap-3">
            <Link
              href={'/courses/import' as Route}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Импорт из Moodle
            </Link>
            <Link
              href="/courses/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Создать курс
            </Link>
          </div>
        )}
      </div>

      <CoursesList courses={courses} />
    </div>
  );
}

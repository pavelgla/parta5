import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverCaller } from '@/server/trpc/caller';

export default async function CoursesPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const caller = await serverCaller();
  const courses = await caller.course.list();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Курсы</h1>
        <Link
          href="/courses/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Создать курс
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-500">Нет курсов. Создайте первый!</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900 line-clamp-2">{course.title}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    course.status === 'PUBLISHED'
                      ? 'bg-green-100 text-green-700'
                      : course.status === 'ARCHIVED'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {course.status === 'PUBLISHED'
                    ? 'Опубликован'
                    : course.status === 'ARCHIVED'
                      ? 'Архив'
                      : 'Черновик'}
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <Link
                  href={`/courses/${course.id}/edit`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Редактировать
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';
import type { Route } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PreviewCoursePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const caller = await serverCaller();
  const course = await caller.course.get({ id });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/courses/${id}/edit` as Route}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← К редактору
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{course.title}</h1>
      </div>

      <div className="space-y-4">
        {course.modules.map((mod) => (
          <div key={mod.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{mod.title}</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {mod.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={`/courses/${id}/preview/lessons/${lesson.id}` as Route}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-900">{lesson.title}</span>
                  </Link>
                </li>
              ))}
              {mod.lessons.length === 0 && (
                <li className="px-5 py-3 text-sm text-gray-400">Нет уроков</li>
              )}
            </ul>
          </div>
        ))}
        {course.modules.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            Нет модулей
          </div>
        )}
      </div>
    </div>
  );
}

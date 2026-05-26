import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';
import { LessonBlockProgress } from './_lesson-progress';

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function LearnCoursePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');

  const { courseId } = await params;
  const caller = await serverCaller();
  const course = await caller.learn.getCourse({ courseId });

  if (course.status !== 'PUBLISHED' && course.status !== 'ARCHIVED') {
    redirect('/learn');
  }

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.completions.length > 0).length,
    0,
  );
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/courses" className="text-sm text-gray-500 hover:text-gray-900">
          ← Курсы
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{course.title}</h1>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Прогресс</span>
          <span className="font-medium text-gray-900">
            {completedLessons} / {totalLessons} уроков
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {course.modules.map((mod) => (
          <div key={mod.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{mod.title}</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {mod.lessons.map((lesson) => {
                const done = lesson.completions.length > 0;
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/learn/${courseId}/lessons/${lesson.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                          done
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 text-gray-400'
                        }`}
                      >
                        {done ? '✓' : ''}
                      </span>
                      <span
                        className={`text-sm ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                      >
                        {lesson.title}
                      </span>
                      <LessonBlockProgress courseId={courseId} lessonId={lesson.id} />
                    </Link>
                  </li>
                );
              })}
              {mod.lessons.length === 0 && (
                <li className="px-5 py-3 text-sm text-gray-400">Нет уроков</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

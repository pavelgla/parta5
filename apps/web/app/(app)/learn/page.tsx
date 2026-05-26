import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import { CourseCard } from '@/components/course-card';

export default async function LearnPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const caller = await serverCaller();
  const allCourses = await caller.course.list();
  const courses = allCourses.filter((c) => c.status === 'PUBLISHED' || c.status === 'ARCHIVED');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Каталог курсов</h1>

      {courses.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-500">Нет доступных курсов.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} variant="student" />
          ))}
        </ul>
      )}
    </div>
  );
}

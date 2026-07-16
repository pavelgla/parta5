import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';
import { CourseEditor } from './course-editor';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCoursePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const caller = await serverCaller();
  const course = await caller.course.get({ id });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/courses" className="text-sm text-gray-500 hover:text-gray-900">
          ← Курсы
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{course.title}</h1>
        <Link
          href={`/courses/${id}/gradebook`}
          className="ml-auto text-sm font-medium text-blue-600 hover:underline"
        >
          Журнал
        </Link>
      </div>

      <CourseEditor course={course} />
    </div>
  );
}

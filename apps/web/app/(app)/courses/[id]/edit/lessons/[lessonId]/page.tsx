import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';
import { LessonEditor } from './lesson-editor';

interface Props {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function EditLessonPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id: courseId, lessonId } = await params;
  const caller = await serverCaller();
  const lesson = await caller.lesson.get({ id: lessonId });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/courses/${courseId}/edit`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← К курсу
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{lesson.title}</h1>
      </div>

      <LessonEditor courseId={courseId} lesson={lesson} userRole={session.user.role} />
    </div>
  );
}

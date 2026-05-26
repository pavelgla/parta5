import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';
import { CompleteLessonButton } from './complete-lesson-button';

interface Props {
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default async function LessonPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');

  const { courseId, lessonId } = await params;
  const caller = await serverCaller();
  const lesson = await caller.learn.getLesson({ lessonId });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/learn/${courseId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← К курсу
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{lesson.title}</h1>
      </div>

      <div className="space-y-4">
        {lesson.blocks.map((block) => (
          <div key={block.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <LessonBlock type={block.type} data={block.data as Record<string, unknown>} />
          </div>
        ))}
        {lesson.blocks.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            Нет содержимого
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <CompleteLessonButton lessonId={lessonId} isCompleted={lesson.isCompleted} />
      </div>
    </div>
  );
}

function LessonBlock({ type, data }: { type: string; data: Record<string, unknown> }) {
  if (type === 'TEXT') {
    return <div className="prose prose-sm max-w-none text-gray-800">{String(data.text ?? '')}</div>;
  }
  if (type === 'VIDEO') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
        <iframe
          src={String(data.url ?? '')}
          className="h-full w-full"
          allowFullScreen
          title="Видео"
        />
      </div>
    );
  }
  return (
    <a
      href={String(data.url ?? '#')}
      className="text-blue-600 hover:underline text-sm"
      target="_blank"
      rel="noreferrer"
    >
      📎 {String(data.filename ?? 'Файл')}
    </a>
  );
}

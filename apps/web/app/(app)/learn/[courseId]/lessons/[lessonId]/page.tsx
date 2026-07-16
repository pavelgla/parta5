import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';
import { CompleteLessonButton } from './complete-lesson-button';
import { BlockTracker } from '@/components/learn/block-tracker';
import { VideoProgressTracker } from '@/components/learn/video-progress-tracker';
import { QuizPlayer } from '@/components/learn/quiz-player';
import { getFileUrl } from '@/lib/file-url';

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
        {lesson.blocks.map((block) => {
          const isViewed = block.blockViews.length > 0;
          const data = block.data as Record<string, unknown>;

          if (block.type === 'VIDEO') {
            return (
              <BlockTracker
                key={block.id}
                blockId={block.id}
                blockType={block.type}
                initialViewed={isViewed}
              >
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <VideoProgressTracker
                    blockId={block.id}
                    video={{ type: 'hls', videoAssetId: String(data.videoAssetId ?? '') }}
                  />
                </div>
              </BlockTracker>
            );
          }

          if (block.type === 'VIDEO_EMBED') {
            return (
              <BlockTracker
                key={block.id}
                blockId={block.id}
                blockType={block.type}
                initialViewed={isViewed}
              >
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <VideoProgressTracker
                    blockId={block.id}
                    video={{
                      type: 'embed',
                      provider: String(data.provider ?? ''),
                      embedUrl: String(data.embedUrl ?? ''),
                      title: data.title ? String(data.title) : undefined,
                    }}
                  />
                </div>
              </BlockTracker>
            );
          }

          return (
            <BlockTracker
              key={block.id}
              blockId={block.id}
              blockType={block.type}
              initialViewed={isViewed}
            >
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <LessonBlock type={block.type} data={data} />
              </div>
            </BlockTracker>
          );
        })}
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
    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: String(data.html ?? data.text ?? '') }}
      />
    );
  }
  if (type === 'HEADING') {
    return <h2 className="text-xl font-bold">{String(data.text ?? '')}</h2>;
  }
  if (type === 'LIST') {
    const items = Array.isArray(data.items) ? data.items : [];
    return (
      <ul className="list-disc pl-4">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-800">
            {String(item ?? '')}
          </li>
        ))}
      </ul>
    );
  }
  if (type === 'IMAGE') {
    return (
      <img
        src={getFileUrl({ key: String(data.key ?? '') })}
        alt={String(data.alt ?? '')}
        className="max-w-full rounded-lg"
      />
    );
  }
  if (type === 'FILE') {
    return (
      <a
        href={getFileUrl({ key: String(data.key ?? data.url ?? '#') })}
        className="text-blue-600 hover:underline text-sm"
        target="_blank"
        rel="noreferrer"
      >
        {String(data.filename ?? 'Файл')}
      </a>
    );
  }
  if (type === 'CALLOUT') {
    return <div className="rounded-lg bg-blue-50 p-4 text-blue-800">{String(data.text ?? '')}</div>;
  }
  if (type === 'CODE') {
    return (
      <pre className="rounded bg-gray-100 p-3 text-sm overflow-x-auto">
        <code>{String(data.code ?? '')}</code>
      </pre>
    );
  }
  if (type === 'QUOTE') {
    return (
      <blockquote className="border-l-4 border-gray-300 pl-4 text-gray-600 italic">
        {String(data.text ?? '')}
      </blockquote>
    );
  }
  if (type === 'DIVIDER') {
    return <hr className="border-gray-200" />;
  }
  if (type === 'QUIZ') {
    return <QuizPlayer quizId={String(data.quizId ?? '')} title={String(data.title ?? '')} />;
  }
  // Fallback
  return (
    <a
      href={String(data.url ?? '#')}
      className="text-blue-600 hover:underline text-sm"
      target="_blank"
      rel="noreferrer"
    >
      {String(data.filename ?? 'Файл')}
    </a>
  );
}

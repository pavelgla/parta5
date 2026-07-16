import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';
import type { Route } from 'next';
import { ListChecks } from 'lucide-react';
import { BlockTracker } from '@/components/learn/block-tracker';
import { VideoProgressTracker } from '@/components/learn/video-progress-tracker';
import { getFileUrl } from '@/lib/file-url';

interface Props {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function PreviewLessonPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id, lessonId } = await params;
  const caller = await serverCaller();
  const lesson = await caller.learn.getLesson({ lessonId });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/courses/${id}/preview` as Route}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
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
    const fileAssetId = data.fileAssetId ? String(data.fileAssetId) : '';
    if (!fileAssetId) {
      return <p className="text-sm text-gray-400">Изображение недоступно</p>;
    }
    return (
      <img
        src={getFileUrl({ id: fileAssetId })}
        alt={String(data.alt ?? '')}
        className="max-w-full rounded-lg"
      />
    );
  }
  if (type === 'FILE') {
    const fileAssetId = data.fileAssetId ? String(data.fileAssetId) : '';
    if (!fileAssetId) {
      return <p className="text-sm text-gray-400">Файл недоступен</p>;
    }
    return (
      <a
        href={getFileUrl({ id: fileAssetId })}
        download
        className="text-blue-600 hover:underline text-sm"
        target="_blank"
        rel="noreferrer"
      >
        {String(data.displayName ?? 'Файл')}
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
    // Предпросмотр не записывает прогресс, поэтому попытку здесь не начинаем —
    // показываем карточку теста со ссылкой на его настройки.
    const quizId = data.quizId ? String(data.quizId) : '';
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="shrink-0 text-gray-400" />
          <span className="font-medium text-gray-900">
            Тест: {String(data.title ?? 'без названия')}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Прохождение доступно ученику в опубликованном курсе.
        </p>
        {quizId && (
          <Link
            href={{ pathname: `/quizzes/${quizId}` }}
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            Настроить тест
          </Link>
        )}
      </div>
    );
  }
  // Неизвестный тип блока: раньше здесь рисовалась ссылка «Файл» на data.url —
  // для любого нового типа (например QUIZ) это давало битую ссылку под видом файла.
  return <p className="text-sm text-gray-400">Неподдерживаемый тип блока: {type}</p>;
}

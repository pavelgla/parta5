'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc/react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ContentBlock {
  id: string;
  type: string;
  data: unknown;
  order: number;
}

interface LessonDetail {
  id: string;
  title: string;
  blocks: ContentBlock[];
}

interface Props {
  courseId: string;
  lesson: LessonDetail;
}

export function LessonEditor({ courseId, lesson }: Props) {
  const router = useRouter();

  const deleteLesson = trpc.lesson.delete.useMutation({
    onSuccess: () => router.push(`/courses/${courseId}/edit`),
  });

  const createBlock = trpc.block.create.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-3 shadow-sm">
        <span className="text-sm text-gray-500">{lesson.blocks.length} блоков</span>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Удалить урок «${lesson.title}»?`)) {
              deleteLesson.mutate({ id: lesson.id });
            }
          }}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Удалить урок
        </button>
      </div>

      {lesson.blocks
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((block) => (
          <BlockItem key={block.id} block={block} />
        ))}

      {lesson.blocks.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          Нет блоков — добавьте первый
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          createBlock.mutate({
            lessonId: lesson.id,
            type: 'TEXT',
            data: { markdown: '' },
          })
        }
        disabled={createBlock.isPending}
        className="w-full rounded-xl border border-dashed border-blue-300 py-3 text-sm font-medium text-blue-600 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        {createBlock.isPending ? 'Создание…' : '+ Текстовый блок'}
      </button>
    </div>
  );
}

function BlockItem({ block }: { block: ContentBlock }) {
  const router = useRouter();
  const markdown = (block.data as { markdown?: string })?.markdown ?? '';
  const [text, setText] = useState(markdown);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateBlock = trpc.block.update.useMutation({
    onSuccess: () => setSaveStatus('saved'),
    onError: () => setSaveStatus('dirty'),
  });

  const deleteBlock = trpc.block.delete.useMutation({
    onSuccess: () => router.refresh(),
  });

  const save = useCallback(
    (value: string) => {
      setSaveStatus('saving');
      updateBlock.mutate({ id: block.id, data: { markdown: value } });
    },
    [block.id, updateBlock],
  );

  function handleChange(value: string) {
    setText(value);
    setSaveStatus('dirty');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 500);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-xs text-gray-400 font-medium">TEXT</span>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${
              saveStatus === 'saving'
                ? 'text-yellow-500'
                : saveStatus === 'dirty'
                  ? 'text-gray-400'
                  : 'text-green-600'
            }`}
          >
            {saveStatus === 'saving' ? 'Сохраняется…' : saveStatus === 'dirty' ? '●' : 'Сохранено'}
          </span>
          <button
            type="button"
            onClick={() => {
              if (confirm('Удалить блок?')) deleteBlock.mutate({ id: block.id });
            }}
            className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
            title="Удалить блок"
          >
            ×
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Markdown-текст…"
          className="h-48 w-full resize-none px-4 py-3 text-sm font-mono focus:outline-none"
          spellCheck={false}
        />
        <div className="h-48 overflow-y-auto px-4 py-3 prose prose-sm max-w-none text-gray-800">
          {text ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          ) : (
            <span className="text-gray-300 text-sm">Предпросмотр</span>
          )}
        </div>
      </div>
    </div>
  );
}

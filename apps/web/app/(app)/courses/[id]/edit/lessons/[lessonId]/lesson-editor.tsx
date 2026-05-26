'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/react';
import { useRouter } from 'next/navigation';
import { BlockEditor } from '@/components/block-editor/block-editor';
import type { ContentBlock } from '@/components/block-editor/types';

interface RawBlock {
  id: string;
  type: string;
  data: unknown;
  order: number;
}

interface LessonDetail {
  id: string;
  title: string;
  blocks: RawBlock[];
}

interface Props {
  courseId: string;
  lesson: LessonDetail;
  userRole: string;
}

function toContentBlock(b: RawBlock): ContentBlock {
  return {
    id: b.id,
    type: b.type,
    data: typeof b.data === 'object' && b.data !== null ? (b.data as Record<string, unknown>) : {},
    order: b.order,
  };
}

export function LessonEditor({ courseId, lesson, userRole }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [editingTitle, setEditingTitle] = useState(false);

  const updateLesson = trpc.lesson.update.useMutation({
    onSuccess: () => router.refresh(),
  });

  const deleteLesson = trpc.lesson.delete.useMutation({
    onSuccess: () => router.push(`/courses/${courseId}/edit`),
  });

  function handleTitleBlur() {
    setEditingTitle(false);
    if (title !== lesson.title) {
      updateLesson.mutate({ id: lesson.id, title });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-3 shadow-sm">
        {editingTitle ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setTitle(lesson.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            className="flex-1 text-lg font-semibold outline-none bg-transparent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="flex-1 text-left text-lg font-semibold hover:text-blue-600 transition-colors"
          >
            {title}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`Удалить урок «${lesson.title}»?`)) {
              deleteLesson.mutate({ id: lesson.id });
            }
          }}
          className="ml-4 text-sm text-red-500 hover:text-red-700 flex-shrink-0"
        >
          Удалить урок
        </button>
      </div>

      <BlockEditor
        lessonId={lesson.id}
        initialBlocks={lesson.blocks.map(toContentBlock)}
        userRole={userRole}
      />
    </div>
  );
}

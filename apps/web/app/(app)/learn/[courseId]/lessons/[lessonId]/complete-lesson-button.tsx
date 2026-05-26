'use client';

import { trpc } from '@/lib/trpc/react';
import { useRouter } from 'next/navigation';

interface Props {
  lessonId: string;
  isCompleted: boolean;
}

export function CompleteLessonButton({ lessonId, isCompleted }: Props) {
  const router = useRouter();

  const complete = trpc.learn.completeLesson.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (isCompleted) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">
          ✓
        </span>
        Урок завершён
      </div>
    );
  }

  return (
    <button
      onClick={() => complete.mutate({ lessonId })}
      disabled={complete.isPending}
      className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {complete.isPending ? 'Сохранение…' : 'Завершить урок'}
    </button>
  );
}

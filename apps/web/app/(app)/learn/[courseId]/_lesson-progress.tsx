'use client';

import { trpc } from '@/lib/trpc/react';

export function LessonBlockProgress({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const { data } = trpc.progress.courseProgress.useQuery({ courseId });
  const lessonData = data?.find((l) => l.lessonId === lessonId);

  if (!lessonData || lessonData.totalBlocks === 0) return null;

  const allDone = lessonData.completedBlocks >= lessonData.totalBlocks;

  return (
    <span className={`ml-auto text-xs ${allDone ? 'text-green-600' : 'text-gray-400'}`}>
      {lessonData.completedBlocks}/{lessonData.totalBlocks} блоков
    </span>
  );
}

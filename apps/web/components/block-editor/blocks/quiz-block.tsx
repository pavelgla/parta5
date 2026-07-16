'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { X, ListChecks } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import type { BlockProps } from '../types';

export function QuizBlock({ block, onChange, onDelete, onSavingChange }: BlockProps) {
  const quizId = (block.data.quizId as string) ?? '';
  const title = (block.data.title as string) ?? '';

  const { data: quizzes } = trpc.quiz.list.useQuery(undefined, { enabled: !quizId });

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const selected = quizzes?.find((q) => q.id === selectedId);
    const data = { quizId: selectedId, title: selected?.title ?? '' };
    onChange(data);
    updateBlock.mutate({ id: block.id, type: 'QUIZ', data });
  }

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
        title="Удалить блок"
      >
        <X size={14} />
      </button>

      {quizId ? (
        <div className="flex items-center gap-3">
          <ListChecks size={20} className="shrink-0 text-gray-400" />
          <p className="flex-1 text-sm font-medium text-gray-700">Тест: {title}</p>
          <Link
            href={`/quizzes/${quizId}` as Route}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Настроить
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <ListChecks size={20} className="shrink-0 text-gray-400" />
          <select
            defaultValue=""
            onChange={handleSelect}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              Выберите тест...
            </option>
            {quizzes?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

'use client';

import { X, ListChecks } from 'lucide-react';
import type { BlockProps } from '../types';

// QUIZ blocks are only created by the mod_quiz importer (see @parta5/importer) —
// there is no "create QUIZ block" option in the block-type palette.
export function QuizBlock({ block, onDelete }: Pick<BlockProps, 'block' | 'onDelete'>) {
  const title = (block.data.title as string) ?? '';

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

      <div className="flex items-center gap-3">
        <ListChecks size={20} className="shrink-0 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">Тест: {title}</p>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
          прохождение — скоро
        </span>
      </div>
    </div>
  );
}

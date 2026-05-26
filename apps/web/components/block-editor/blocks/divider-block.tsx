'use client';

import { X } from 'lucide-react';
import type { BlockProps } from '../types';

export function DividerBlock({ onDelete }: Pick<BlockProps, 'onDelete'>) {
  return (
    <div className="group relative py-2">
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
        title="Удалить блок"
      >
        <X size={14} />
      </button>
      <hr className="border-gray-200" />
    </div>
  );
}

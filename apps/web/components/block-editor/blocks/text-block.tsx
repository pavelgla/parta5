'use client';

import { useDebouncedCallback } from 'use-debounce';
import { X } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { TipTapEditor } from '@/components/tiptap/editor';
import type { BlockProps } from '../types';

export function TextBlock({
  block,
  onChange,
  onDelete,
  onInsertBelow,
  onFocusPrev,
  onSavingChange,
  autoFocus,
}: BlockProps) {
  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((html: string, text: string) => {
    updateBlock.mutate({ id: block.id, type: 'TEXT', data: { html, text } });
  }, 500);

  const handleChange = (html: string, text: string) => {
    onChange({ html, text });
    save(html, text);
  };

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

      <div className="min-h-[1.5rem] [&_.tiptap]:outline-none [&_.tiptap]:min-h-[1.5rem] prose prose-sm max-w-none">
        <TipTapEditor
          content={(block.data.html as string) ?? ''}
          onChange={handleChange}
          placeholder="Начните вводить текст..."
          minimal
          autoFocus={autoFocus}
          onEnter={() => onInsertBelow?.()}
          onBackspaceOnEmpty={() => onFocusPrev?.()}
        />
      </div>
    </div>
  );
}

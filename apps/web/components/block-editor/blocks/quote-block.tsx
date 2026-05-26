'use client';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X, Quote } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import type { BlockProps } from '../types';

export function QuoteBlock({ block, onChange, onDelete, onSavingChange, autoFocus }: BlockProps) {
  const [text, setText] = useState<string>((block.data.text as string) ?? '');
  const [author, setAuthor] = useState<string>((block.data.author as string) ?? '');

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((t: string, a: string) => {
    updateBlock.mutate({
      id: block.id,
      type: 'QUOTE',
      data: { text: t, author: a || undefined },
    });
  }, 500);

  const handleTextChange = (value: string) => {
    setText(value);
    onChange({ text: value, author });
    save(value, author);
  };

  const handleAuthorChange = (value: string) => {
    setAuthor(value);
    onChange({ text, author: value });
    save(text, value);
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

      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <Quote size={18} className="text-gray-300 shrink-0" />
          <div className="mt-2 w-0.5 flex-1 bg-gray-200" />
        </div>
        <div className="flex-1 space-y-2">
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            autoFocus={autoFocus}
            placeholder="Текст цитаты..."
            rows={3}
            className="w-full resize-none bg-transparent text-base text-gray-700 italic outline-none placeholder-gray-300 leading-relaxed"
          />
          <input
            type="text"
            value={author}
            onChange={(e) => handleAuthorChange(e.target.value)}
            placeholder="Автор (необязательно)"
            className="w-full bg-transparent text-sm text-gray-400 outline-none placeholder-gray-300"
          />
        </div>
      </div>
    </div>
  );
}

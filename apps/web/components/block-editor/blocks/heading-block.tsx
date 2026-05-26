'use client';

import { useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import type { BlockProps } from '../types';

const levelClass: Record<1 | 2 | 3, string> = {
  1: 'text-3xl font-bold',
  2: 'text-2xl font-bold',
  3: 'text-xl font-semibold',
};

export function HeadingBlock({
  block,
  onChange,
  onDelete,
  onInsertBelow,
  onFocusPrev,
  onSavingChange,
  autoFocus,
}: BlockProps) {
  const [level, setLevel] = useState<1 | 2 | 3>((block.data.level as 1 | 2 | 3) ?? 2);
  const [text, setText] = useState<string>((block.data.text as string) ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((l: 1 | 2 | 3, t: string) => {
    updateBlock.mutate({ id: block.id, type: 'HEADING', data: { level: l, text: t } });
  }, 500);

  const handleTextChange = (value: string) => {
    setText(value);
    onChange({ level, text: value });
    save(level, value);
  };

  const handleLevelChange = (l: 1 | 2 | 3) => {
    setLevel(l);
    onChange({ level: l, text });
    save(l, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onInsertBelow?.();
    } else if (e.key === 'Backspace' && text === '') {
      e.preventDefault();
      onFocusPrev?.();
    }
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

      <div className="mb-2 flex gap-1">
        {([1, 2, 3] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => handleLevelChange(l)}
            className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
              level === l
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            H{l}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        placeholder="Заголовок..."
        className={`w-full bg-transparent outline-none placeholder-gray-300 ${levelClass[level]}`}
      />
    </div>
  );
}

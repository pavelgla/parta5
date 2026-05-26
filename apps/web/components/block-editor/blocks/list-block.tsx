'use client';

import { useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X, List, ListOrdered } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import type { BlockProps } from '../types';

export function ListBlock({ block, onChange, onDelete, onSavingChange, autoFocus }: BlockProps) {
  const [ordered, setOrdered] = useState<boolean>((block.data.ordered as boolean) ?? false);
  const [items, setItems] = useState<string[]>((block.data.items as string[]) ?? ['']);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((o: boolean, i: string[]) => {
    updateBlock.mutate({ id: block.id, type: 'LIST', data: { ordered: o, items: i } });
  }, 500);

  const handleTextChange = (value: string) => {
    const newItems = value.split('\n');
    setItems(newItems);
    onChange({ ordered, items: newItems });
    save(ordered, newItems);
  };

  const handleOrderedToggle = (newOrdered: boolean) => {
    setOrdered(newOrdered);
    onChange({ ordered: newOrdered, items });
    save(newOrdered, items);
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
        <button
          type="button"
          onClick={() => handleOrderedToggle(false)}
          className={`rounded p-1.5 transition-colors ${
            !ordered
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }`}
          title="Маркированный список"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => handleOrderedToggle(true)}
          className={`rounded p-1.5 transition-colors ${
            ordered
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }`}
          title="Нумерованный список"
        >
          <ListOrdered size={14} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={items.join('\n')}
        onChange={(e) => handleTextChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Пункт 1&#10;Пункт 2&#10;Пункт 3"
        rows={Math.max(3, items.length)}
        className="w-full resize-none bg-transparent outline-none text-sm text-gray-700 placeholder-gray-300 leading-relaxed"
      />

      {items.length > 0 && items[0] !== '' && (
        <div className="mt-2 pointer-events-none">
          {ordered ? (
            <ol className="list-decimal list-inside text-sm text-gray-500 space-y-0.5">
              {items.filter(Boolean).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          ) : (
            <ul className="list-disc list-inside text-sm text-gray-500 space-y-0.5">
              {items.filter(Boolean).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

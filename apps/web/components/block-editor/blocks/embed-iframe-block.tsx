'use client';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X, Code2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import type { BlockProps } from '../types';

export function EmbedIframeBlock({ block, onChange, onDelete, onSavingChange }: BlockProps) {
  const [url, setUrl] = useState<string>((block.data.url as string) ?? '');
  const [height, setHeight] = useState<number>((block.data.height as number) ?? 400);

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((u: string, h: number) => {
    updateBlock.mutate({
      id: block.id,
      type: 'EMBED_IFRAME',
      data: { url: u || undefined, height: h },
    });
  }, 500);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    onChange({ url: value, height });
    save(value, height);
  };

  const handleHeightChange = (value: number) => {
    const h = Math.max(100, Math.min(2000, value));
    setHeight(h);
    onChange({ url, height: h });
    save(url, h);
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

      <div className="mb-3 flex items-center gap-2">
        <Code2 size={14} className="shrink-0 text-gray-400" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Встроенный фрейм
        </span>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://..."
          className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-400 whitespace-nowrap">Высота px</label>
          <input
            type="number"
            value={height}
            min={100}
            max={2000}
            step={50}
            onChange={(e) => handleHeightChange(Number(e.target.value))}
            className="w-20 rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {url ? (
        <iframe
          src={url}
          style={{ height: `${height}px` }}
          className="w-full rounded border border-gray-200"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Встроенный контент"
        />
      ) : (
        <div
          style={{ height: `${height}px` }}
          className="flex items-center justify-center rounded border-2 border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400"
        >
          Введите URL для отображения
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import type { BlockProps } from '../types';

type CalloutVariant = 'info' | 'warning' | 'success' | 'danger';

const VARIANTS: {
  value: CalloutVariant;
  label: string;
  icon: React.ElementType;
  classes: string;
}[] = [
  { value: 'info', label: 'Инфо', icon: Info, classes: 'border-blue-200 bg-blue-50 text-blue-800' },
  {
    value: 'warning',
    label: 'Важно',
    icon: AlertTriangle,
    classes: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  },
  {
    value: 'success',
    label: 'Успех',
    icon: CheckCircle,
    classes: 'border-green-200 bg-green-50 text-green-800',
  },
  {
    value: 'danger',
    label: 'Ошибка',
    icon: AlertCircle,
    classes: 'border-red-200 bg-red-50 text-red-800',
  },
];

export function CalloutBlock({ block, onChange, onDelete, onSavingChange, autoFocus }: BlockProps) {
  const [variant, setVariant] = useState<CalloutVariant>(
    (block.data.variant as CalloutVariant) ?? 'info',
  );
  const [text, setText] = useState<string>((block.data.text as string) ?? '');

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((v: CalloutVariant, t: string) => {
    updateBlock.mutate({ id: block.id, type: 'CALLOUT', data: { variant: v, text: t } });
  }, 500);

  const handleVariantChange = (v: CalloutVariant) => {
    setVariant(v);
    onChange({ variant: v, text });
    save(v, text);
  };

  const handleTextChange = (value: string) => {
    setText(value);
    onChange({ variant, text: value });
    save(variant, value);
  };

  const current = VARIANTS.find((v) => v.value === variant)!;
  const Icon = current.icon;

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
        {VARIANTS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => handleVariantChange(v.value)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              variant === v.value
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className={`flex gap-3 rounded-lg border p-3 ${current.classes}`}>
        <Icon size={18} className="mt-0.5 shrink-0" />
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Текст подсказки..."
          rows={2}
          className="flex-1 resize-none bg-transparent outline-none text-sm placeholder-current placeholder-opacity-50 leading-relaxed"
        />
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import type { BlockProps } from '../types';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'sql', label: 'SQL' },
  { value: 'plain', label: 'Текст' },
];

export function CodeBlock({ block, onChange, onDelete, onSavingChange, autoFocus }: BlockProps) {
  const [language, setLanguage] = useState<string>((block.data.language as string) ?? 'javascript');
  const [code, setCode] = useState<string>((block.data.code as string) ?? '');

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((lang: string, c: string) => {
    updateBlock.mutate({ id: block.id, type: 'CODE', data: { language: lang, code: c } });
  }, 500);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    onChange({ language: lang, code });
    save(lang, code);
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    onChange({ language, code: value });
    save(language, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = code.substring(0, start) + '  ' + code.substring(end);
      handleCodeChange(newValue);
      requestAnimationFrame(() => {
        target.selectionStart = start + 2;
        target.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
        title="Удалить блок"
      >
        <X size={14} />
      </button>

      <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-transparent text-xs text-gray-300 outline-none cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value} className="bg-gray-800">
              {lang.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">Tab = 2 пробела</span>
      </div>

      <textarea
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        placeholder="// код..."
        spellCheck={false}
        rows={Math.max(4, code.split('\n').length + 1)}
        className="w-full resize-none bg-gray-900 p-4 font-mono text-sm text-gray-100 outline-none placeholder-gray-600 leading-relaxed"
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Heading1,
  Type,
  List,
  Image,
  Video,
  Link,
  FileText,
  AlertTriangle,
  Code2,
  Minus,
  Globe,
  X,
  Quote,
  ListChecks,
} from 'lucide-react';
import type { BlockType } from './types';

interface BlockOption {
  type: BlockType;
  name: string;
  description: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const BLOCK_OPTIONS: BlockOption[] = [
  {
    type: 'HEADING',
    name: 'Заголовок',
    description: 'H1, H2 или H3',
    icon: <Heading1 size={16} />,
  },
  { type: 'TEXT', name: 'Текст', description: 'Абзац с форматированием', icon: <Type size={16} /> },
  {
    type: 'LIST',
    name: 'Список',
    description: 'Маркированный или нумерованный',
    icon: <List size={16} />,
  },
  {
    type: 'IMAGE',
    name: 'Изображение',
    description: 'Загрузить картинку',
    icon: <Image size={16} />,
  },
  { type: 'VIDEO', name: 'Видео', description: 'Загрузить видеофайл', icon: <Video size={16} /> },
  {
    type: 'VIDEO_EMBED',
    name: 'Видео-ссылка',
    description: 'YouTube, RuTube, VK и др.',
    icon: <Link size={16} />,
  },
  { type: 'FILE', name: 'Файл', description: 'PDF, документ, архив', icon: <FileText size={16} /> },
  {
    type: 'CALLOUT',
    name: 'Заметка',
    description: 'Информация, предупреждение, успех',
    icon: <AlertTriangle size={16} />,
  },
  {
    type: 'CODE',
    name: 'Код',
    description: 'Блок кода с подсветкой языка',
    icon: <Code2 size={16} />,
  },
  { type: 'QUOTE', name: 'Цитата', description: 'Цитата с автором', icon: <Quote size={16} /> },
  {
    type: 'QUIZ',
    name: 'Тест',
    description: 'Вставить тест из банка',
    icon: <ListChecks size={16} />,
  },
  {
    type: 'DIVIDER',
    name: 'Разделитель',
    description: 'Горизонтальная линия',
    icon: <Minus size={16} />,
  },
  {
    type: 'EMBED_IFRAME',
    name: 'Iframe',
    description: 'Встроить внешний ресурс',
    icon: <Globe size={16} />,
    adminOnly: true,
  },
];

interface Props {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  isAdmin: boolean;
}

export function BlockTypeMenu({ onSelect, onClose, isAdmin }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = BLOCK_OPTIONS.filter((opt) => {
    if (opt.adminOnly && !isAdmin) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return opt.name.toLowerCase().includes(q) || opt.description.toLowerCase().includes(q);
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) {
        onSelect(filtered[activeIndex].type);
      }
      return;
    }
  }

  return (
    <div
      ref={menuRef}
      className="z-50 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск типа блока..."
          className="flex-1 text-sm outline-none placeholder-gray-400"
        />
        <button type="button" onClick={onClose} className="text-gray-300 hover:text-gray-500">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-sm text-gray-400">Ничего не найдено</p>
        )}
        {filtered.map((opt, idx) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => onSelect(opt.type)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              idx === activeIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="flex-shrink-0 text-current opacity-60">{opt.icon}</span>
            <div>
              <div className="text-sm font-medium">{opt.name}</div>
              <div className="text-xs text-gray-400">{opt.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

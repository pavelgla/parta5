'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { SortableBlock } from './sortable-block';
import { BlockTypeMenu } from './block-type-menu';
import { type BlockType, type ContentBlock } from './types';
import {
  HeadingBlock,
  TextBlock,
  ListBlock,
  ImageBlock,
  VideoBlock,
  VideoEmbedBlock,
  FileBlock,
  CalloutBlock,
  CodeBlock,
  QuoteBlock,
  DividerBlock,
  EmbedIframeBlock,
  QuizBlock,
} from './blocks';

interface Props {
  lessonId: string;
  initialBlocks: ContentBlock[];
  userRole: string;
}

const ADMIN_ROLES = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];

function BlockRenderer({
  block,
  onChange,
  onDelete,
  onInsertBelow,
  onFocusPrev,
  onSavingChange,
  autoFocus,
}: {
  block: ContentBlock;
  onChange: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onInsertBelow?: () => void;
  onFocusPrev?: () => void;
  onSavingChange?: (saving: boolean) => void;
  autoFocus?: boolean;
}) {
  const props = {
    block,
    onChange,
    onDelete,
    onInsertBelow,
    onFocusPrev,
    onSavingChange,
    autoFocus,
  };
  switch (block.type) {
    case 'HEADING':
      return <HeadingBlock {...props} />;
    case 'TEXT':
      return <TextBlock {...props} />;
    case 'LIST':
      return <ListBlock {...props} />;
    case 'IMAGE':
      return <ImageBlock {...props} />;
    case 'VIDEO':
      return <VideoBlock {...props} />;
    case 'VIDEO_EMBED':
      return <VideoEmbedBlock {...props} />;
    case 'FILE':
      return <FileBlock {...props} />;
    case 'CALLOUT':
      return <CalloutBlock {...props} />;
    case 'CODE':
      return <CodeBlock {...props} />;
    case 'QUOTE':
      return <QuoteBlock {...props} />;
    case 'DIVIDER':
      return <DividerBlock {...props} />;
    case 'EMBED_IFRAME':
      return <EmbedIframeBlock {...props} />;
    case 'QUIZ':
      return <QuizBlock {...props} />;
    default:
      return null;
  }
}

interface MenuState {
  afterBlockId: string | null;
}

function getDefaultData(type: BlockType): Record<string, unknown> {
  switch (type) {
    case 'HEADING':
      return { level: 2, text: '' };
    case 'TEXT':
      return { html: '', text: '' };
    case 'LIST':
      return { ordered: false, items: [] };
    case 'IMAGE':
      return { alt: '', caption: '' };
    case 'VIDEO':
      return {};
    case 'VIDEO_EMBED':
      return {};
    case 'FILE':
      return { displayName: '' };
    case 'CALLOUT':
      return { variant: 'info', text: '' };
    case 'CODE':
      return { language: 'javascript', code: '' };
    case 'QUOTE':
      return { text: '', author: '' };
    case 'DIVIDER':
      return {};
    case 'EMBED_IFRAME':
      return { height: 400 };
    case 'QUIZ':
      // unreachable via the palette — QUIZ blocks come only from the mod_quiz importer
      return { quizId: '', title: '' };
  }
}

export function BlockEditor({ lessonId, initialBlocks, userRole }: Props) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    [...initialBlocks].sort((a, b) => a.order - b.order),
  );
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);

  const isAdmin = ADMIN_ROLES.includes(userRole);

  const createBlock = trpc.block.create.useMutation({
    onSuccess(newBlock) {
      const typed: ContentBlock = {
        id: newBlock.id,
        type: newBlock.type,
        data:
          typeof newBlock.data === 'object' && newBlock.data !== null
            ? (newBlock.data as Record<string, unknown>)
            : {},
        order: newBlock.order,
      };
      setBlocks((prev) => {
        const afterId = menu?.afterBlockId;
        if (afterId === null || afterId === undefined) {
          return [...prev, typed];
        }
        const idx = prev.findIndex((b) => b.id === afterId);
        const next = [...prev];
        next.splice(idx + 1, 0, typed);
        return next.map((b, i) => ({ ...b, order: i }));
      });
      setJustCreatedId(newBlock.id);
      setMenu(null);
    },
  });

  const reorder = trpc.block.reorder.useMutation();

  useEffect(() => {
    if (!justCreatedId) return;
    const t = setTimeout(() => setJustCreatedId(null), 200);
    return () => clearTimeout(t);
  }, [justCreatedId]);

  const handleSavingChange = useCallback((saving: boolean) => {
    setSavingCount((c) => Math.max(0, saving ? c + 1 : c - 1));
  }, []);

  const handleBlockChange = useCallback((id: string, data: Record<string, unknown>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)),
    );
  }, []);

  const deleteBlock = trpc.block.delete.useMutation({
    onSuccess(_, vars) {
      setBlocks((prev) => prev.filter((b) => b.id !== vars.id));
    },
  });

  const handleDelete = useCallback(
    (id: string) => {
      deleteBlock.mutate({ id });
    },
    [deleteBlock],
  );

  function handleAddBlock(type: BlockType) {
    const data = getDefaultData(type);
    createBlock.mutate({ lessonId, type, data });
  }

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(blocks, oldIdx, newIdx).map((b, i) => ({ ...b, order: i }));
    setBlocks(reordered);
    reorder.mutate({ lessonId, blockIds: reordered.map((b) => b.id) });
  }

  const saveStatus = savingCount > 0 ? 'saving' : 'saved';

  return (
    <div className="relative">
      <div className="fixed bottom-4 right-4 z-40 text-xs text-gray-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full border border-gray-100 shadow-sm">
        {saveStatus === 'saving' ? 'Сохраняется...' : 'Сохранено'}
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="pl-8 space-y-1">
            {blocks.map((block, index) => (
              <Fragment key={block.id}>
                <AddBlockRow
                  onClick={() => setMenu({ afterBlockId: blocks[index - 1]?.id ?? null })}
                  alwaysVisible={false}
                />
                <SortableBlock id={block.id}>
                  <BlockRenderer
                    block={block}
                    onChange={(data) => handleBlockChange(block.id, data)}
                    onDelete={() => handleDelete(block.id)}
                    onInsertBelow={() => setMenu({ afterBlockId: block.id })}
                    onFocusPrev={() => {
                      const prev = blocks[index - 1];
                      if (prev) {
                        handleDelete(block.id);
                      }
                    }}
                    onSavingChange={handleSavingChange}
                    autoFocus={block.id === justCreatedId}
                  />
                </SortableBlock>
              </Fragment>
            ))}

            {blocks.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                Нет блоков — нажмите «+» чтобы добавить
              </div>
            )}

            <AddBlockRow
              onClick={() => setMenu({ afterBlockId: blocks[blocks.length - 1]?.id ?? null })}
              alwaysVisible
            />
          </div>
        </SortableContext>
      </DndContext>

      {menu !== null && (
        <div className="absolute left-8 z-50 mt-1" style={{ top: getMenuTop(menu, blocks) }}>
          <BlockTypeMenu
            isAdmin={isAdmin}
            onSelect={handleAddBlock}
            onClose={() => setMenu(null)}
          />
        </div>
      )}
    </div>
  );
}

function getMenuTop(menu: MenuState, blocks: ContentBlock[]): string {
  if (!menu.afterBlockId) return '100%';
  const idx = blocks.findIndex((b) => b.id === menu.afterBlockId);
  if (idx < 0) return '100%';
  return `${(idx + 1) * 120}px`;
}

function AddBlockRow({ onClick, alwaysVisible }: { onClick: () => void; alwaysVisible: boolean }) {
  return (
    <div
      className={`group/add flex items-center gap-2 py-0.5 ${
        alwaysVisible ? '' : 'opacity-0 hover:opacity-100 focus-within:opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-sm transition-colors ${
          alwaysVisible
            ? 'w-full justify-center border-blue-200 text-blue-500 hover:border-blue-400 hover:bg-blue-50'
            : 'border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
        }`}
      >
        <Plus size={14} />
        {alwaysVisible && <span>Добавить блок</span>}
      </button>
    </div>
  );
}

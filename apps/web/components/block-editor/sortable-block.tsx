'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface Props {
  id: string;
  children: React.ReactNode;
}

export function SortableBlock({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      <button
        type="button"
        className="absolute -left-6 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover/sortable:opacity-100 rounded p-0.5 text-gray-300 hover:text-gray-500 transition-all touch-none"
        {...attributes}
        {...listeners}
        tabIndex={-1}
      >
        <GripVertical size={16} />
      </button>
      {children}
    </div>
  );
}

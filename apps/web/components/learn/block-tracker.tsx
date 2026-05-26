'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc/react';
import { usePreviewMode } from '@/lib/preview-context';

// Block types that auto-complete on view (no separate player event needed)
const AUTO_COMPLETE_TYPES = new Set([
  'TEXT',
  'HEADING',
  'LIST',
  'IMAGE',
  'FILE',
  'CALLOUT',
  'CODE',
  'QUOTE',
  'DIVIDER',
  'EMBED_IFRAME',
]);

interface Props {
  blockId: string;
  blockType: string;
  initialViewed?: boolean; // true if already viewed in a previous session
  children: React.ReactNode;
}

export function BlockTracker({ blockId, blockType, initialViewed = false, children }: Props) {
  const isPreview = usePreviewMode();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewedThisSession = useRef<Set<string>>(new Set());

  const markViewed = trpc.progress.markBlockViewed.useMutation();
  const markCompleted = trpc.progress.markBlockCompleted.useMutation();

  // Stable refs to the latest mutate functions so useEffect deps stay clean
  const markViewedMutate = useRef(markViewed.mutate);
  markViewedMutate.current = markViewed.mutate;
  const markCompletedMutate = useRef(markCompleted.mutate);
  markCompletedMutate.current = markCompleted.mutate;

  // Pre-populate session dedup if already viewed in a previous session
  useEffect(() => {
    if (initialViewed) {
      viewedThisSession.current.add(blockId);
    }
  }, [blockId, initialViewed]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastEntry: IntersectionObserverEntry | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        lastEntry = entry;

        if (entry.isIntersecting && !viewedThisSession.current.has(blockId)) {
          timeoutId = setTimeout(() => {
            if (lastEntry?.isIntersecting) {
              if (!isPreview) {
                markViewedMutate.current({ blockId });
                viewedThisSession.current.add(blockId);
                if (AUTO_COMPLETE_TYPES.has(blockType)) {
                  markCompletedMutate.current({ blockId });
                }
              }
            }
          }, 2000);
        } else {
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      observer.disconnect();
    };
  }, [blockId, blockType, isPreview]);

  return <div ref={wrapperRef}>{children}</div>;
}

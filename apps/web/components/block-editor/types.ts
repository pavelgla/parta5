export type BlockType =
  | 'HEADING'
  | 'TEXT'
  | 'LIST'
  | 'IMAGE'
  | 'VIDEO'
  | 'VIDEO_EMBED'
  | 'FILE'
  | 'CALLOUT'
  | 'CODE'
  | 'QUOTE'
  | 'DIVIDER'
  | 'EMBED_IFRAME'
  | 'QUIZ';

export interface ContentBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
  order: number;
}

export const BLOCK_DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  HEADING: { level: 2, text: '' },
  TEXT: { html: '', text: '' },
  LIST: { ordered: false, items: [] },
  IMAGE: { alt: '', caption: '' },
  VIDEO: {},
  VIDEO_EMBED: {},
  FILE: { displayName: '' },
  CALLOUT: { variant: 'info', text: '' },
  CODE: { language: 'javascript', code: '' },
  QUOTE: { text: '', author: '' },
  DIVIDER: {},
  EMBED_IFRAME: { height: 400 },
  // QUIZ blocks are only created by the mod_quiz importer, never via the palette.
  QUIZ: { quizId: '', title: '' },
};

export interface BlockProps {
  block: ContentBlock;
  onChange: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onInsertBelow?: () => void;
  onFocusPrev?: () => void;
  onSavingChange?: (saving: boolean) => void;
  autoFocus?: boolean;
}

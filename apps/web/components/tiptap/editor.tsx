'use client';

import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useMemo, useRef } from 'react';

interface Props {
  content: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  minimal?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
  onBackspaceOnEmpty?: () => void;
  className?: string;
}

export function TipTapEditor({
  content,
  onChange,
  placeholder,
  minimal,
  autoFocus,
  onEnter,
  onBackspaceOnEmpty,
  className,
}: Props) {
  const handlersRef = useRef({ onEnter, onBackspaceOnEmpty });
  handlersRef.current = { onEnter, onBackspaceOnEmpty };

  const keyboardExt = useMemo(
    () =>
      Extension.create({
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              const cb = handlersRef.current.onEnter;
              if (cb) {
                cb();
                return true;
              }
              return false;
            },
            Backspace: () => {
              const cb = handlersRef.current.onBackspaceOnEmpty;
              if (cb && this.editor.isEmpty) {
                cb();
                return true;
              }
              return false;
            },
          };
        },
      }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: minimal ? false : { levels: [1, 2, 3] },
        blockquote: minimal ? false : {},
        codeBlock: minimal ? false : {},
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      keyboardExt,
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    onUpdate({ editor }) {
      onChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: { class: 'outline-none' },
    },
  });

  if (!editor) return null;

  return <EditorContent editor={editor} className={className} />;
}

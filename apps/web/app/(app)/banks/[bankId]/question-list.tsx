'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { trpc } from '@/lib/trpc/react';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/components/question-editor/types';

interface QuestionRow {
  id: string;
  type: QuestionType;
  name: string;
  updatedAt: Date | string;
}

interface Props {
  bankId: string;
  initialItems: QuestionRow[];
  initialNextCursor?: string;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const TYPE_BADGE_CLASS: Record<QuestionType, string> = {
  MULTICHOICE: 'bg-blue-50 text-blue-700',
  TRUEFALSE: 'bg-green-50 text-green-700',
  SHORTANSWER: 'bg-amber-50 text-amber-700',
};

export function QuestionList({ bankId, initialItems, initialNextCursor }: Props) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const utils = trpc.useUtils();

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await utils.questionBank.questions.fetch({
        bankId,
        cursor: nextCursor,
        take: 50,
      });
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="relative flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Вопросы</h2>
        <button
          type="button"
          onClick={() => setTypeMenuOpen((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          + Новый вопрос
        </button>
        {typeMenuOpen && (
          <div className="absolute right-6 top-12 z-10 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
              <Link
                key={type}
                href={`/banks/${bankId}/questions/new?type=${type}` as Route}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setTypeMenuOpen(false)}
              >
                {QUESTION_TYPE_LABELS[type]}
              </Link>
            ))}
          </div>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
            <th className="px-6 py-2 font-medium">Тип</th>
            <th className="px-6 py-2 font-medium">Название</th>
            <th className="px-6 py-2 font-medium">Обновлён</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((q) => (
            <tr key={q.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[q.type]}`}
                >
                  {QUESTION_TYPE_LABELS[q.type]}
                </span>
              </td>
              <td className="px-6 py-3">
                <Link
                  href={`/banks/${bankId}/questions/${q.id}` as Route}
                  className="text-gray-900 hover:text-blue-600"
                >
                  {q.name}
                </Link>
              </td>
              <td className="px-6 py-3 text-gray-400">
                {dateFormatter.format(new Date(q.updatedAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <p className="px-6 py-8 text-center text-sm text-gray-400">Нет вопросов в этом банке</p>
      )}

      {nextCursor && (
        <div className="px-6 py-4 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
          >
            {loading ? 'Загрузка…' : 'Показать ещё'}
          </button>
        </div>
      )}
    </div>
  );
}

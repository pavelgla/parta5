'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/components/question-editor/types';

interface QuestionOption {
  id: string;
  type: QuestionType;
  name: string;
}

interface Props {
  excludeIds: string[];
  onAdd: (questions: QuestionOption[]) => void;
  onClose: () => void;
}

export function AddFromBankModal({ excludeIds, onAdd, onClose }: Props) {
  const [bankId, setBankId] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const { data: banks } = trpc.questionBank.list.useQuery();
  const { data: page, isLoading } = trpc.questionBank.questions.useQuery(
    { bankId, take: 200 },
    { enabled: !!bankId },
  );

  const excluded = new Set(excludeIds);
  const options = (page?.items ?? []).filter((q) => !excluded.has(q.id));

  function toggle(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const selected = options.filter((q) => checkedIds.has(q.id));
    onAdd(selected);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Добавить из банка</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-gray-100 px-6 py-3">
          <select
            value={bankId}
            onChange={(e) => {
              setBankId(e.target.value);
              setCheckedIds(new Set());
            }}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Выберите банк...</option>
            {banks?.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {!bankId && <p className="py-6 text-center text-sm text-gray-400">Выберите банк</p>}
          {bankId && isLoading && (
            <p className="py-6 text-center text-sm text-gray-400">Загрузка…</p>
          )}
          {bankId && !isLoading && options.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Нет доступных вопросов</p>
          )}
          <ul className="divide-y divide-gray-100">
            {options.map((q) => (
              <li key={q.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(q.id)}
                    onChange={() => toggle(q.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {QUESTION_TYPE_LABELS[q.type]}
                  </span>
                  <span className="flex-1 truncate text-sm text-gray-900">{q.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={checkedIds.size === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Добавить выбранные
          </button>
        </div>
      </div>
    </div>
  );
}

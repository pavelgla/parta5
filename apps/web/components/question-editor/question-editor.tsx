'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { trpc } from '@/lib/trpc/react';
import { MultichoiceEditor } from './multichoice-editor';
import { TruefalseEditor } from './truefalse-editor';
import { ShortanswerEditor } from './shortanswer-editor';
import { QuestionPreview } from './question-preview';
import { validateQuestion, hasErrors, type ValidationErrors } from './validate';
import type { QuestionData } from './types';

interface Props {
  bankId: string;
  mode: 'create' | 'edit';
  questionId?: string;
  initialName?: string;
  initialData: QuestionData;
}

export function QuestionEditor({ bankId, mode, questionId, initialName, initialData }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? '');
  const [data, setData] = useState<QuestionData>(initialData);
  const [tab, setTab] = useState<'editor' | 'preview'>('editor');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const bankHref = `/banks/${bankId}` as Route;

  function handleMutationError(err: { message: string }) {
    setServerError(err.message);
  }

  const createQuestion = trpc.questionBank.createQuestion.useMutation({
    onSuccess: () => router.push(bankHref),
    onError: handleMutationError,
  });

  const updateQuestion = trpc.questionBank.updateQuestion.useMutation({
    onSuccess: () => router.push(bankHref),
    onError: handleMutationError,
  });

  const isPending = createQuestion.isPending || updateQuestion.isPending;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const validation = validateQuestion(name, data);
    setErrors(validation);
    if (hasErrors(validation)) return;

    if (mode === 'create') {
      createQuestion.mutate({ bankId, name: name.trim(), data });
    } else if (questionId) {
      updateQuestion.mutate({ id: questionId, name: name.trim(), data });
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('editor')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'editor'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Редактор
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'preview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Превью
        </button>
      </div>

      {tab === 'editor' ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Внутреннее название вопроса"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Текст вопроса</label>
            <textarea
              value={data.prompt}
              onChange={(e) => setData({ ...data, prompt: e.target.value })}
              rows={3}
              placeholder="Сформулируйте вопрос"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.prompt && <p className="mt-1 text-sm text-red-600">{errors.prompt}</p>}
          </div>

          {data.type === 'MULTICHOICE' && (
            <MultichoiceEditor data={data} onChange={setData} error={errors.choices} />
          )}
          {data.type === 'TRUEFALSE' && <TruefalseEditor data={data} onChange={setData} />}
          {data.type === 'SHORTANSWER' && (
            <ShortanswerEditor data={data} onChange={setData} error={errors.acceptedAnswers} />
          )}
        </div>
      ) : (
        <QuestionPreview data={data} />
      )}

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(bankHref)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

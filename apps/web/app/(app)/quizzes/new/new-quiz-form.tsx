'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { trpc } from '@/lib/trpc/react';

export function NewQuizForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [passingScore, setPassingScore] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createQuiz = trpc.quiz.create.useMutation({
    onSuccess: (quiz) => router.push(`/quizzes/${quiz.id}` as Route),
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Укажите название теста');
      return;
    }
    createQuiz.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      timeLimitSeconds: timeLimitMinutes ? Number(timeLimitMinutes) * 60 : undefined,
      maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
      passingScore: passingScore ? Number(passingScore) : undefined,
      shuffleQuestions,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700">Название</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Лимит времени (мин)</label>
          <input
            type="number"
            min={1}
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(e.target.value)}
            placeholder="Без лимита"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Попыток</label>
          <input
            type="number"
            min={1}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
            placeholder="Без ограничений"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Порог сдачи (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
            placeholder="—"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={shuffleQuestions}
          onChange={(e) => setShuffleQuestions(e.target.checked)}
          className="rounded border-gray-300"
        />
        Перемешивать вопросы
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/quizzes' as Route)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={createQuiz.isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {createQuiz.isPending ? 'Создание…' : 'Создать'}
        </button>
      </div>
    </form>
  );
}

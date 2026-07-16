'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/components/question-editor/types';
import { AddFromBankModal } from './add-from-bank-modal';

interface QuizQuestionItem {
  questionId: string;
  points: number;
  question: { id: string; type: QuestionType; name: string };
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  timeLimitSeconds: number | null;
  maxAttempts: number | null;
  passingScore: number | null;
  shuffleQuestions: boolean;
  quizQuestions: QuizQuestionItem[];
}

interface Props {
  quiz: Quiz;
}

const TYPE_BADGE_CLASS: Record<QuestionType, string> = {
  MULTICHOICE: 'bg-blue-50 text-blue-700',
  TRUEFALSE: 'bg-green-50 text-green-700',
  SHORTANSWER: 'bg-amber-50 text-amber-700',
};

export function QuizEditor({ quiz }: Props) {
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? '');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    quiz.timeLimitSeconds ? String(Math.round(quiz.timeLimitSeconds / 60)) : '',
  );
  const [maxAttempts, setMaxAttempts] = useState(quiz.maxAttempts ? String(quiz.maxAttempts) : '');
  const [passingScore, setPassingScore] = useState(
    quiz.passingScore !== null && quiz.passingScore !== undefined ? String(quiz.passingScore) : '',
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(quiz.shuffleQuestions);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [items, setItems] = useState<QuizQuestionItem[]>(quiz.quizQuestions);
  const [modalOpen, setModalOpen] = useState(false);
  const [questionsSaved, setQuestionsSaved] = useState(false);

  const updateQuiz = trpc.quiz.update.useMutation({
    onSuccess: () => {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    },
  });

  const setQuestions = trpc.quiz.setQuestions.useMutation({
    onSuccess: () => {
      setQuestionsSaved(true);
      setTimeout(() => setQuestionsSaved(false), 2000);
    },
  });

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    updateQuiz.mutate({
      id: quiz.id,
      title: title.trim(),
      description: description.trim() || null,
      timeLimitSeconds: timeLimitMinutes ? Number(timeLimitMinutes) * 60 : null,
      maxAttempts: maxAttempts ? Number(maxAttempts) : null,
      passingScore: passingScore ? Number(passingScore) : null,
      shuffleQuestions,
    });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setItems((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function setPoints(index: number, points: number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, points } : item)));
  }

  function handleAddQuestions(added: Array<{ id: string; type: QuestionType; name: string }>) {
    const existingIds = new Set(items.map((item) => item.questionId));
    const newItems = added
      .filter((q) => !existingIds.has(q.id))
      .map((q) => ({ questionId: q.id, points: 1, question: q }));
    setItems((prev) => [...prev, ...newItems]);
    setModalOpen(false);
  }

  function handleSaveQuestions() {
    setQuestions.mutate({
      quizId: quiz.id,
      items: items.map((item) => ({ questionId: item.questionId, points: item.points })),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <form
        onSubmit={handleSaveSettings}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm h-fit"
      >
        <h2 className="font-semibold text-gray-900">Настройки</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700">Лимит (мин)</label>
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
              placeholder="Без огр."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Порог (%)</label>
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

        <div className="flex items-center justify-end gap-3">
          {settingsSaved && <span className="text-sm text-green-600">Сохранено</span>}
          <button
            type="submit"
            disabled={updateQuiz.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateQuiz.isPending ? 'Сохранение…' : 'Сохранить настройки'}
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm h-fit">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Состав теста</h2>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            + Добавить из банка
          </button>
        </div>

        <ul className="divide-y divide-gray-100">
          {items.map((item, index) => (
            <li key={item.questionId} className="flex items-center gap-3 py-3">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[item.question.type]}`}
              >
                {QUESTION_TYPE_LABELS[item.question.type]}
              </span>
              <span className="flex-1 truncate text-sm text-gray-900">{item.question.name}</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={item.points}
                onChange={(e) => setPoints(index, Number(e.target.value))}
                className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:outline-none"
              />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  title="Вверх"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={index === items.length - 1}
                  className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  title="Вниз"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded p-1 text-gray-400 hover:text-red-500"
                  title="Убрать"
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-8 text-center text-sm text-gray-400">В тесте нет вопросов</li>
          )}
        </ul>

        <div className="flex items-center justify-end gap-3">
          {questionsSaved && <span className="text-sm text-green-600">Сохранено</span>}
          <button
            type="button"
            onClick={handleSaveQuestions}
            disabled={setQuestions.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {setQuestions.isPending ? 'Сохранение…' : 'Сохранить состав'}
          </button>
        </div>
      </div>

      {modalOpen && (
        <AddFromBankModal
          excludeIds={items.map((item) => item.questionId)}
          onAdd={handleAddQuestions}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

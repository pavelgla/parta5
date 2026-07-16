'use client';

import Link from 'next/link';
import type { Route } from 'next';

interface Quiz {
  id: string;
  title: string;
  createdAt: Date;
  _count: { quizQuestions: number; attempts: number };
}

interface Props {
  quizzes: Quiz[];
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function QuizList({ quizzes }: Props) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Тесты</h2>
        <Link
          href={'/quizzes/new' as Route}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          + Новый квиз
        </Link>
      </div>

      <ul className="divide-y divide-gray-100">
        {quizzes.map((quiz) => (
          <li key={quiz.id} className="hover:bg-gray-50 transition-colors">
            <Link href={`/quizzes/${quiz.id}` as Route} className="block px-6 py-3">
              <div className="text-sm font-medium text-gray-900 truncate">{quiz.title}</div>
              <div className="text-xs text-gray-400">
                {quiz._count.quizQuestions} вопрос(ов) · {quiz._count.attempts} попыт(ок) · создан{' '}
                {dateFormatter.format(new Date(quiz.createdAt))}
              </div>
            </Link>
          </li>
        ))}
        {quizzes.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-gray-400">
            Нет тестов. Создайте первый!
          </li>
        )}
      </ul>
    </div>
  );
}

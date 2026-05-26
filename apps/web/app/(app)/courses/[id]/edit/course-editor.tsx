'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/react';
import { useRouter } from 'next/navigation';
import type { CourseStatus } from '@parta5/db';

interface Lesson {
  id: string;
  title: string;
  order: number;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  modules: CourseModule[];
}

interface Props {
  course: CourseDetail;
}

export function CourseEditor({ course }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? '');
  const [status, setStatus] = useState(course.status);

  const updateMutation = trpc.course.update.useMutation({
    onSuccess: () => router.refresh(),
  });

  const deleteMutation = trpc.course.delete.useMutation({
    onSuccess: () => router.push('/courses'),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({ id: course.id, title, description: description || undefined, status });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
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
        <div>
          <label className="block text-sm font-medium text-gray-700">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="DRAFT">Черновик</option>
            <option value="PUBLISHED">Опубликован</option>
            <option value="ARCHIVED">Архив</option>
          </select>
        </div>
        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (confirm('Удалить курс? Это действие необратимо.')) {
                deleteMutation.mutate({ id: course.id });
              }
            }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Удалить курс
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>

      <ModuleList courseId={course.id} modules={course.modules} />
    </div>
  );
}

function ModuleList({ courseId, modules }: { courseId: string; modules: CourseModule[] }) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const createModule = trpc.module.create.useMutation({
    onSuccess: () => {
      setNewTitle('');
      setAdding(false);
      router.refresh();
    },
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Модули</h2>
        <button
          onClick={() => setAdding(true)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          + Добавить модуль
        </button>
      </div>

      <ul className="divide-y divide-gray-100">
        {modules.map((mod) => (
          <li key={mod.id} className="px-6 py-3">
            <span className="text-sm text-gray-900">{mod.title}</span>
            <span className="ml-2 text-xs text-gray-400">({mod.lessons.length} уроков)</span>
          </li>
        ))}
        {modules.length === 0 && !adding && (
          <li className="px-6 py-4 text-sm text-gray-400 text-center">Нет модулей</li>
        )}
      </ul>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) createModule.mutate({ courseId, title: newTitle.trim() });
          }}
          className="flex gap-2 px-6 py-3 border-t border-gray-100"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            placeholder="Название модуля"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={createModule.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Добавить
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Отмена
          </button>
        </form>
      )}
    </div>
  );
}

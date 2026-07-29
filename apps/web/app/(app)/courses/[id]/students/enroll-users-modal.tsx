'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/react';

interface Props {
  courseId: string;
  excludeUserIds: string[];
  onClose: () => void;
  onEnrolled: () => void;
}

export function EnrollUsersModal({ courseId, excludeUserIds, onClose, onEnrolled }: Props) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: users, isLoading } = trpc.user.list.useQuery({
    activeOnly: true,
    search: search.trim() || undefined,
  });

  const excluded = new Set(excludeUserIds);
  const options = (users ?? []).filter((u) => !excluded.has(u.id));

  const enrollUsers = trpc.enrollment.enrollUsers.useMutation({
    onSuccess: () => onEnrolled(),
    onError: (err) => setError(err.message),
  });

  function toggle(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (checkedIds.size === 0) return;
    setError(null);
    enrollUsers.mutate({ courseId, userIds: Array.from(checkedIds), role });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Зачислить пользователей</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ×
          </button>
        </div>

        <div className="space-y-3 border-b border-gray-100 px-6 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'STUDENT' | 'TEACHER')}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="STUDENT">Зачислить как слушателей</option>
            <option value="TEACHER">Зачислить как преподавателей</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {isLoading && <p className="py-6 text-center text-sm text-gray-400">Загрузка…</p>}
          {!isLoading && options.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              {search.trim() ? 'Никого не найдено' : 'Нет доступных пользователей'}
            </p>
          )}
          <ul className="divide-y divide-gray-100">
            {options.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="flex-1 truncate">
                    <span className="block truncate text-sm text-gray-900">{u.name}</span>
                    <span className="block truncate text-xs text-gray-400">{u.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="px-6 text-sm text-red-600">{error}</p>}

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
            onClick={handleSubmit}
            disabled={checkedIds.size === 0 || enrollUsers.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {enrollUsers.isPending
              ? 'Зачисление…'
              : `Зачислить выбранных${checkedIds.size ? ` (${checkedIds.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

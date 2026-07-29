'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { UserRole } from '@parta5/db';
import { trpc } from '@/lib/trpc/react';
import { ALL_ROLES, ROLE_LABELS } from './role-labels';

interface Props {
  currentUserId: string;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function UserList({ currentUserId }: Props) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);

  const trimmedSearch = search.trim();
  const {
    data: users,
    isLoading,
    refetch,
  } = trpc.user.list.useQuery({
    search: trimmedSearch || undefined,
    role: role || undefined,
  });

  const setActive = trpc.user.setActive.useMutation({ onSuccess: () => refetch() });

  const rows = useMemo(() => users ?? [], [users]);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или email"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Все роли</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Имя', 'Email', 'Роль', 'Статус', 'Курсов', 'Создан', 'Действия'].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Загрузка…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Пользователи не найдены.
                </td>
              </tr>
            )}
            {rows.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50 ${user.isActive ? '' : 'opacity-50'}`}>
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/admin/users/${user.id}` as Route}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {user.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{user.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {ROLE_LABELS[user.role]}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.isActive ? 'Активен' : 'Деактивирован'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {user._count.enrollments}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {dateFormatter.format(new Date(user.createdAt))}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Link
                      href={`/admin/users/${user.id}` as Route}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Изменить
                    </Link>
                    <button
                      type="button"
                      disabled={setActive.isPending || user.id === currentUserId}
                      title={
                        user.id === currentUserId ? 'Нельзя деактивировать самого себя' : undefined
                      }
                      onClick={() => setActive.mutate({ id: user.id, isActive: !user.isActive })}
                      className="font-medium text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {user.isActive ? 'Деактивировать' : 'Активировать'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetTargetId(user.id)}
                      className="font-medium text-gray-600 hover:text-gray-900"
                    >
                      Сбросить пароль
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetTargetId && (
        <ResetPasswordModal userId={resetTargetId} onClose={() => setResetTargetId(null)} />
      )}
    </div>
  );
}

function ResetPasswordModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const resetPassword = trpc.user.resetPassword.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов');
      return;
    }
    resetPassword.mutate({ id: userId, password });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Сбросить пароль</h2>
        {done ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-green-700">Пароль обновлён.</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Новый пароль</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="Не менее 8 символов"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={resetPassword.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {resetPassword.isPending ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

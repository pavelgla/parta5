'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { UserRole } from '@parta5/db';
import { trpc } from '@/lib/trpc/react';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '../role-labels';

interface CourseStub {
  id: string;
  title: string;
  status: string;
  enrollmentRole: string;
  enrolledAt: Date | string;
}

interface GroupStub {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date | string;
  groups: GroupStub[];
  courses: CourseStub[];
}

interface Props {
  user: UserData;
  currentUserId: string;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const COURSE_STATUS_LABEL: Record<string, string> = {
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'Архив',
  DRAFT: 'Черновик',
};

export function UserDetail({ user, currentUserId }: Props) {
  const router = useRouter();
  const isSelf = user.id === currentUserId;

  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;

  const updateUser = trpc.user.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    },
    onError: (err) => setSaveError(err.message),
  });

  const setActive = trpc.user.setActive.useMutation({
    onSuccess: (result) => {
      setIsActive(result.isActive);
      router.refresh();
    },
    onError: (err) => setSaveError(err.message),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    if (!name.trim()) {
      setNameError('Укажите имя');
      return;
    }
    setNameError(null);
    updateUser.mutate({
      id: user.id,
      name: name.trim(),
      ...(isSelf ? {} : { role }),
    });
  }

  function handleToggleActive() {
    if (isActive && isSelf) return;
    if (isActive && !confirm(`Деактивировать пользователя «${user.name}»?`)) return;
    setActive.mutate({ id: user.id, isActive: !isActive });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isActive ? 'Активен' : 'Деактивирован'}
          </span>
          <span className="text-sm text-gray-500">
            создан {dateFormatter.format(new Date(user.createdAt))}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ФИО</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {nameError && <p className="mt-1 text-sm text-red-600">{nameError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Роль</label>
            {isSelf || isSuperAdmin ? (
              <input
                type="text"
                value={ROLE_LABELS[user.role]}
                disabled
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            ) : (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}
            {isSelf && (
              <p className="mt-1 text-xs text-gray-400">Нельзя изменить собственную роль</p>
            )}
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={updateUser.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateUser.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
            {saved && <span className="text-sm text-green-600">Сохранено</span>}
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={setActive.isPending || (isActive && isSelf)}
            title={isActive && isSelf ? 'Нельзя деактивировать самого себя' : undefined}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {isActive ? 'Деактивировать' : 'Активировать'}
          </button>
          <button
            type="button"
            onClick={() => setShowReset((v) => !v)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Сбросить пароль
          </button>
        </div>

        {showReset && <ResetPasswordInline userId={user.id} onDone={() => setShowReset(false)} />}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Группы</h2>
        {user.groups.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Не состоит ни в одной группе.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {user.groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/admin/groups/${g.id}` as Route}
                  className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Курсы</h2>
        {user.courses.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Не зачислен ни на один курс.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr>
                  {['Курс', 'Статус', 'Роль', 'Зачислен'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {user.courses.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link
                        href={`/courses/${c.id}/edit` as Route}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {COURSE_STATUS_LABEL[c.status] ?? c.status}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {c.enrollmentRole}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                      {dateFormatter.format(new Date(c.enrolledAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ResetPasswordInline({ userId, onDone }: { userId: string; onDone: () => void }) {
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

  if (done) {
    return (
      <div className="mt-4 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
        <p className="text-sm text-green-700">Пароль обновлён.</p>
        <button
          type="button"
          onClick={onDone}
          className="text-sm font-medium text-green-700 hover:underline"
        >
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-wrap items-start gap-3 border-t border-gray-100 pt-4"
    >
      <div className="flex-1 min-w-[200px]">
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="Новый пароль, не менее 8 символов"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={resetPassword.isPending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {resetPassword.isPending ? 'Сохранение…' : 'Сохранить'}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Отмена
      </button>
    </form>
  );
}

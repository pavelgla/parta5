'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/react';

interface Group {
  id: string;
  name: string;
  createdAt: Date | string;
  memberCount: number;
}

interface Props {
  groups: Group[];
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function GroupList({ groups }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createGroup = trpc.group.create.useMutation({
    onSuccess: () => {
      setNewName('');
      setCreating(false);
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Список групп</h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Новая группа
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createGroup.mutate({ name: newName.trim() });
          }}
          className="flex flex-wrap gap-2 border-b border-gray-100 px-6 py-3"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            placeholder="Название группы, например 8А"
            className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={createGroup.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Создать
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName('');
              setError(null);
            }}
            className="px-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Отмена
          </button>
        </form>
      )}

      {error && <p className="px-6 py-2 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-100">
        {groups.map((group) => (
          <GroupRow key={group.id} group={group} />
        ))}
        {groups.length === 0 && !creating && (
          <li className="px-6 py-8 text-center text-sm text-gray-400">
            Нет групп. Создайте первую!
          </li>
        )}
      </ul>
    </div>
  );
}

function GroupRow({ group }: { group: Group }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string | null>(null);

  const renameGroup = trpc.group.rename.useMutation({
    onSuccess: () => {
      setRenaming(false);
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  const removeGroup = trpc.group.remove.useMutation({
    onSuccess: () => router.refresh(),
    onError: (err) => setError(err.message),
  });

  if (renaming) {
    return (
      <li className="px-6 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) renameGroup.mutate({ id: group.id, name: name.trim() });
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="min-w-[160px] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={renameGroup.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => {
              setRenaming(false);
              setName(group.name);
              setError(null);
            }}
            className="px-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Отмена
          </button>
        </form>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-gray-50">
      <Link href={`/admin/groups/${group.id}` as Route} className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">{group.name}</div>
        <div className="text-xs text-gray-400">
          {group.memberCount} участник(ов) · создана{' '}
          {dateFormatter.format(new Date(group.createdAt))}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="text-xs text-gray-400 hover:text-gray-700"
        >
          Переименовать
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                `Удалить группу «${group.name}»? Пользователи из группы удалены не будут — они лишь перестанут в неё входить.`,
              )
            ) {
              removeGroup.mutate({ id: group.id });
            }
          }}
          className="text-lg leading-none text-gray-300 transition-colors hover:text-red-500"
          title="Удалить группу"
        >
          ×
        </button>
      </div>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </li>
  );
}

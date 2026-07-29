'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/react';

interface Member {
  id: string;
  name: string;
  email: string;
}

interface Props {
  groupId: string;
  members: Member[];
  availableUsers: Member[];
}

export function GroupDetail({ groupId, members, availableUsers }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const removeMember = trpc.group.removeMember.useMutation({
    onSuccess: () => router.refresh(),
    onError: (err) => setError(err.message),
  });

  const addMembers = trpc.group.addMembers.useMutation({
    onSuccess: () => {
      setSelected(new Set());
      setShowAdd(false);
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableUsers;
    return availableUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [availableUsers, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (selected.size === 0) return;
    addMembers.mutate({ groupId, userIds: Array.from(selected) });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Участники ({members.length})</h2>
          {!showAdd && availableUsers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Добавить участников
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {members.length === 0 ? (
          <p className="text-sm text-gray-400">В группе пока никого нет.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <Link
                  href={`/admin/users/${m.id}` as Route}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  {m.name}
                  <span className="ml-2 truncate text-xs font-normal text-gray-400">{m.email}</span>
                </Link>
                <button
                  type="button"
                  disabled={removeMember.isPending}
                  onClick={() => removeMember.mutate({ groupId, userId: m.id })}
                  className="shrink-0 text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
                >
                  Убрать из группы
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAdd && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Добавить участников</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email"
            className="mt-3 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2">
            {filteredAvailable.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-gray-400">Никого не найдено.</p>
            )}
            {filteredAvailable.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => toggle(u.id)}
                  className="rounded border-gray-300"
                />
                <span className="truncate text-gray-900">{u.name}</span>
                <span className="truncate text-xs text-gray-400">{u.email}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setSelected(new Set());
                setSearch('');
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || addMembers.isPending}
              onClick={handleAdd}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {addMembers.isPending ? 'Добавление…' : `Добавить (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/react';
import type { GroupOption } from './students-manager';

interface Props {
  courseId: string;
  groups: GroupOption[];
  onClose: () => void;
  onEnrolled: () => void;
}

export function EnrollGroupModal({ courseId, groups, onClose, onEnrolled }: Props) {
  const [groupId, setGroupId] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [error, setError] = useState<string | null>(null);

  const enrollGroup = trpc.enrollment.enrollGroup.useMutation({
    onSuccess: () => onEnrolled(),
    onError: (err) => setError(err.message),
  });

  const selectedGroup = groups.find((g) => g.id === groupId) ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setError(null);
    enrollGroup.mutate({ courseId, groupId, role });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Зачислить группу</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500">
              В школе пока нет ни одной группы. Создайте группу в администрировании школы, чтобы
              зачислять слушателей списком.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Группа</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Выберите группу…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g._count.memberships}{' '}
                      {g._count.memberships === 1 ? 'участник' : 'участников'})
                    </option>
                  ))}
                </select>
                {selectedGroup && (
                  <p className="mt-1 text-xs text-gray-400">
                    Будет зачислено участников: {selectedGroup._count.memberships}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Роль на курсе</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'STUDENT' | 'TEACHER')}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="STUDENT">Слушатель</option>
                  <option value="TEACHER">Преподаватель</option>
                </select>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!groupId || enrollGroup.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {enrollGroup.isPending ? 'Зачисление…' : 'Зачислить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

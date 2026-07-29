'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/react';
import { EnrollGroupModal } from './enroll-group-modal';
import { EnrollUsersModal } from './enroll-users-modal';

export interface EnrollmentRow {
  id: string;
  userId: string;
  role: 'STUDENT' | 'TEACHER';
  createdAt: Date | string;
  user: { id: string; name: string; email: string; isActive: boolean };
}

export interface GroupOption {
  id: string;
  name: string;
  _count: { memberships: number };
}

interface Props {
  courseId: string;
  enrollments: EnrollmentRow[];
  groups: GroupOption[];
  isAdmin: boolean;
}

const ROLE_LABEL: Record<'STUDENT' | 'TEACHER', string> = {
  STUDENT: 'Слушатель',
  TEACHER: 'Преподаватель',
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFormatter.format(d);
}

export function StudentsManager({ courseId, enrollments, groups, isAdmin }: Props) {
  const router = useRouter();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [unenrollError, setUnenrollError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const unenroll = trpc.enrollment.unenroll.useMutation({
    onSuccess: () => {
      setPendingUserId(null);
      router.refresh();
    },
    onError: (err) => {
      setPendingUserId(null);
      setUnenrollError(err.message);
    },
  });

  function handleUnenroll(row: EnrollmentRow) {
    const confirmed = confirm(
      `Отчислить «${row.user.name}» с курса? Результаты пройденных тестов сохранятся — отчисление удаляет только зачисление на курс.`,
    );
    if (!confirmed) return;
    setUnenrollError(null);
    setPendingUserId(row.userId);
    unenroll.mutate({ courseId, userId: row.userId });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowGroupModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Зачислить группу
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowUsersModal(true)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Зачислить пользователей
          </button>
        )}
      </div>

      {unenrollError && <p className="text-sm text-red-600">{unenrollError}</p>}

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            На курсе пока нет слушателей. Зачислите группу целиком кнопкой «Зачислить группу»
            {isAdmin ? ' или отдельных пользователей кнопкой «Зачислить пользователей».' : '.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700">
                  ФИО
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700">
                  Email
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700">
                  Роль
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700">
                  Зачислен
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-700">
                  Действие
                </th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {row.user.name}
                    {!row.user.isActive && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        отключён
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.user.email}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {ROLE_LABEL[row.role]}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleUnenroll(row)}
                      disabled={unenroll.isPending && pendingUserId === row.userId}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      {unenroll.isPending && pendingUserId === row.userId
                        ? 'Отчисление…'
                        : 'Отчислить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGroupModal && (
        <EnrollGroupModal
          courseId={courseId}
          groups={groups}
          onClose={() => setShowGroupModal(false)}
          onEnrolled={() => {
            setShowGroupModal(false);
            router.refresh();
          }}
        />
      )}

      {isAdmin && showUsersModal && (
        <EnrollUsersModal
          courseId={courseId}
          excludeUserIds={enrollments.map((e) => e.userId)}
          onClose={() => setShowUsersModal(false)}
          onEnrolled={() => {
            setShowUsersModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

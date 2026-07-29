import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { ImportRosterForm } from './import-roster-form';

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function ImportRosterPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.includes(session.user.role)) redirect('/courses');

  const caller = await serverCaller();
  const courses = await caller.course.list();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-gray-500 hover:text-gray-900">
          ← Пользователи
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Импорт из CSV</h1>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Формат файла</h2>
          <p className="mt-2 text-sm text-gray-600">
            CSV с колонками <code className="rounded bg-gray-100 px-1 py-0.5">name</code>,{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">email</code>,{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">role</code> и необязательной{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">group</code>. Разделитель — запятая
            или точка с запятой, кодировка — UTF-8 или Windows-1251 (стандартный экспорт из Excel).
            Роль: <code className="rounded bg-gray-100 px-1 py-0.5">teacher</code>/
            <code className="rounded bg-gray-100 px-1 py-0.5">преподаватель</code> или{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">student</code>/
            <code className="rounded bg-gray-100 px-1 py-0.5">ученик</code>.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['name', 'email', 'role', 'group'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-left font-mono text-xs font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="whitespace-nowrap px-3 py-2">Иванова Мария Сергеевна</td>
                  <td className="whitespace-nowrap px-3 py-2">ivanova@school.ru</td>
                  <td className="whitespace-nowrap px-3 py-2">teacher</td>
                  <td className="whitespace-nowrap px-3 py-2">—</td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-3 py-2">Петров Иван Сергеевич</td>
                  <td className="whitespace-nowrap px-3 py-2">petrov@school.ru</td>
                  <td className="whitespace-nowrap px-3 py-2">student</td>
                  <td className="whitespace-nowrap px-3 py-2">8А</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <ImportRosterForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      </div>
    </div>
  );
}

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { UserList } from './user-list';

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.includes(session.user.role)) redirect('/courses');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users/import"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Импорт из CSV
          </Link>
          <Link
            href="/admin/users/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Добавить пользователя
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <UserList currentUserId={session.user.id} />
      </div>
    </div>
  );
}

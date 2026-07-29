import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { NewUserForm } from './new-user-form';

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function NewUserPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.includes(session.user.role)) redirect('/courses');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-gray-500 hover:text-gray-900">
          ← Пользователи
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Новый пользователь</h1>
      </div>

      <NewUserForm />
    </div>
  );
}

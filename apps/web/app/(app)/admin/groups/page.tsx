import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { GroupList } from './group-list';

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function AdminGroupsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.includes(session.user.role)) redirect('/courses');

  const caller = await serverCaller();
  const groups = await caller.group.list();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Группы</h1>
      <GroupList
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          createdAt: g.createdAt,
          memberCount: g._count.memberships,
        }))}
      />
    </div>
  );
}

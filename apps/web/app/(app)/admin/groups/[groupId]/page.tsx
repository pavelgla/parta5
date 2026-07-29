import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { GroupDetail } from './group-detail';

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function GroupDetailPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.includes(session.user.role)) redirect('/courses');

  const { groupId } = await params;
  const caller = await serverCaller();
  const [group, allUsers] = await Promise.all([
    caller.group.get({ id: groupId }),
    caller.user.list(),
  ]);

  const memberIds = new Set(group.members.map((m) => m.id));
  const availableUsers = allUsers
    .filter((u) => !memberIds.has(u.id) && u.isActive)
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/groups" className="text-sm text-gray-500 hover:text-gray-900">
          ← Группы
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="truncate text-2xl font-bold text-gray-900">{group.name}</h1>
      </div>

      <GroupDetail groupId={group.id} members={group.members} availableUsers={availableUsers} />
    </div>
  );
}

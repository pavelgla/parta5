import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { StudentsManager } from './students-manager';

interface Props {
  params: Promise<{ id: string }>;
}

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];
const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function StudentsPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const { id } = await params;
  const caller = await serverCaller();
  const [course, enrollments, groups] = await Promise.all([
    caller.course.get({ id }),
    caller.enrollment.listByCourse({ courseId: id }),
    caller.group.list(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/courses/${id}/edit` as Route}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← {course.title}
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">Слушатели</h1>
        </div>
        <Link
          href={`/courses/${id}/gradebook` as Route}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Журнал
        </Link>
      </div>

      <StudentsManager
        courseId={id}
        enrollments={enrollments}
        groups={groups}
        isAdmin={ADMIN_ROLES.includes(session.user.role)}
      />
    </div>
  );
}

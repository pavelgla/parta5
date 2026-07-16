import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { GradebookTable } from './gradebook-table';

interface Props {
  params: Promise<{ id: string }>;
}

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function GradebookPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const { id } = await params;
  const caller = await serverCaller();
  const [course, gradebook] = await Promise.all([
    caller.course.get({ id }),
    caller.gradebook.forCourse({ courseId: id }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/courses/${id}/edit`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {course.title}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Журнал</h1>
      </div>

      <GradebookTable courseId={id} courseSlug={course.slug} gradebook={gradebook} />
    </div>
  );
}

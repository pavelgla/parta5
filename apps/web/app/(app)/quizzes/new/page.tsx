import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { NewQuizForm } from './new-quiz-form';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function NewQuizPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/quizzes" className="text-sm text-gray-500 hover:text-gray-900">
          ← Тесты
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Новый тест</h1>
      </div>

      <NewQuizForm />
    </div>
  );
}

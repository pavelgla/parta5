import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { QuizEditor } from './quiz-editor';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

interface Props {
  params: Promise<{ quizId: string }>;
}

export default async function QuizPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const { quizId } = await params;
  const caller = await serverCaller();
  const quiz = await caller.quiz.byId({ id: quizId });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/quizzes" className="text-sm text-gray-500 hover:text-gray-900">
          ← Тесты
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{quiz.title}</h1>
      </div>

      <QuizEditor quiz={quiz} />
    </div>
  );
}

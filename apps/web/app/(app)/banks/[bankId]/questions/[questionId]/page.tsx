import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { QuestionEditor } from '@/components/question-editor/question-editor';
import type { QuestionData } from '@/components/question-editor/types';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

interface Props {
  params: Promise<{ bankId: string; questionId: string }>;
}

export default async function EditQuestionPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const { bankId, questionId } = await params;
  const caller = await serverCaller();
  const banks = await caller.questionBank.list();
  const bank = banks.find((b) => b.id === bankId);
  if (!bank) notFound();

  const question = await caller.questionBank.questionById({ id: questionId });
  const initialData = { ...(question.data as object), type: question.type } as QuestionData;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/banks/${bankId}` as Route}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← {bank.name}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{question.name}</h1>
      </div>

      <QuestionEditor
        bankId={bankId}
        mode="edit"
        questionId={question.id}
        initialName={question.name}
        initialData={initialData}
      />
    </div>
  );
}

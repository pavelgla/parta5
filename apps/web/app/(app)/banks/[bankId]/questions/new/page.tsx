import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { QuestionEditor } from '@/components/question-editor/question-editor';
import {
  QUESTION_TYPE_LABELS,
  defaultDataFor,
  type QuestionType,
} from '@/components/question-editor/types';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];
const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

interface Props {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function NewQuestionPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const { bankId } = await params;
  const { type } = await searchParams;

  const caller = await serverCaller();
  const banks = await caller.questionBank.list();
  const bank = banks.find((b) => b.id === bankId);
  if (!bank) notFound();

  const selectedType = QUESTION_TYPES.includes(type as QuestionType)
    ? (type as QuestionType)
    : undefined;

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
        <h1 className="text-xl font-bold text-gray-900">Новый вопрос</h1>
      </div>

      {selectedType ? (
        <QuestionEditor bankId={bankId} mode="create" initialData={defaultDataFor(selectedType)} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
          {QUESTION_TYPES.map((qType) => (
            <Link
              key={qType}
              href={`/banks/${bankId}/questions/new?type=${qType}` as Route}
              className="block px-6 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {QUESTION_TYPE_LABELS[qType]}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

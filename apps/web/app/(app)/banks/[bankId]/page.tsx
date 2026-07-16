import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { QuestionList } from './question-list';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

interface Props {
  params: Promise<{ bankId: string }>;
}

export default async function BankPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const { bankId } = await params;
  const caller = await serverCaller();
  const banks = await caller.questionBank.list();
  const bank = banks.find((b) => b.id === bankId);
  if (!bank) notFound();

  const firstPage = await caller.questionBank.questions({ bankId, take: 50 });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/banks" className="text-sm text-gray-500 hover:text-gray-900">
          ← Банки вопросов
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{bank.name}</h1>
      </div>

      <QuestionList
        bankId={bankId}
        initialItems={firstPage.items}
        initialNextCursor={firstPage.nextCursor}
      />
    </div>
  );
}

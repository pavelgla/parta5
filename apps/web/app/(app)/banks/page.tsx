import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { BankList } from './bank-list';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function BanksPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!TEACHER_ROLES.includes(session.user.role)) redirect('/learn');

  const caller = await serverCaller();
  const banks = await caller.questionBank.list();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Банки вопросов</h1>
      <BankList banks={banks} />
    </div>
  );
}

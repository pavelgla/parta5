import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@parta5/db';
import { serverCaller } from '@/server/trpc/caller';
import { SchoolSettingsForm } from '@/components/school-settings-form';

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.includes(session.user.role)) redirect('/courses');

  const caller = await serverCaller();
  const school = await caller.school.get();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Настройки школы</h1>
      <SchoolSettingsForm
        school={{
          ...school,
          footerLinks: school.footerLinks as { title: string; url: string }[] | null,
        }}
      />
    </div>
  );
}

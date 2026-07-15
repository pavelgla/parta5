import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@parta5/db';
import { PreviewProvider } from '@/lib/preview-context';

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  if (!TEACHER_ROLES.includes(session.user.role)) {
    redirect('/learn');
  }

  return (
    <PreviewProvider>
      <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-700 font-medium">
        Режим предпросмотра — прогресс не записывается
      </div>
      {children}
    </PreviewProvider>
  );
}

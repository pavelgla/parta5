import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { PreviewProvider } from '@/lib/preview-context';

export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(session.user.role ?? '')) {
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

import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function CoursesPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Курсы</h1>
      <p className="mt-2 text-gray-500">Добро пожаловать, {session.user.name}</p>
    </div>
  );
}

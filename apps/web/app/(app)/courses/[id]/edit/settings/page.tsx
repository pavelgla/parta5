import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import { CourseSettingsForm } from './_form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseSettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const caller = await serverCaller();
  const course = await caller.course.get({ id });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Настройки курса</h1>
      <CourseSettingsForm course={course} />
    </div>
  );
}

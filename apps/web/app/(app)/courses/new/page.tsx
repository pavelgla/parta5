import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';
import Link from 'next/link';

export default async function NewCoursePage() {
  const session = await auth();
  if (!session) redirect('/login');

  async function createCourse(formData: FormData) {
    'use server';
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | undefined;

    const caller = await serverCaller();
    const course = await caller.course.create({ title, description: description || undefined });
    redirect(`/courses/${course.id}/edit`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/courses" className="text-sm text-gray-500 hover:text-gray-900">
          ← Курсы
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Новый курс</h1>
      </div>

      <form
        action={createCourse}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Название
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            autoFocus
            placeholder="Алгебра 8 класс"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Описание <span className="text-gray-400 font-normal">(необязательно)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Краткое описание курса"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/courses"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Отмена
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Создать
          </button>
        </div>
      </form>
    </div>
  );
}

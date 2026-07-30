import Link from 'next/link';
import type { Metadata } from 'next';
import { getCurrentSchool } from '@/lib/school-context';
import { serverCaller } from '@/server/trpc/caller';
import { CatalogCourseCard } from '@/components/catalog-course-card';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const school = await getCurrentSchool();
  const title = school ? `Каталог курсов — ${school.displayName ?? school.name}` : 'Каталог курсов';
  return { title };
}

export default async function CatalogPage({ searchParams }: Props) {
  const school = await getCurrentSchool();

  if (!school) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Каталог курсов</h1>
        <p className="mb-6 text-gray-500">Каталог доступен на сайте конкретной школы.</p>
        <Link
          href="/login"
          className="rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-medium text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
        >
          Войти
        </Link>
      </div>
    );
  }

  const { q } = await searchParams;
  const query = q?.trim() || undefined;

  const caller = await serverCaller();
  const { items: courses, total } = await caller.catalog.list({ query, limit: 60 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Каталог курсов</h1>
      <p className="mt-1 text-sm text-gray-500">
        {total === 0 ? 'Курсы не найдены' : `Найдено курсов: ${total}`}
      </p>

      {/* Plain GET form — no client state, so search works with JavaScript
          disabled: the query just round-trips through the URL as ?q=. */}
      <form method="GET" className="mt-6 flex max-w-md gap-2">
        <label htmlFor="catalog-search" className="sr-only">
          Поиск по названию курса
        </label>
        <input
          id="catalog-search"
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Поиск по названию курса"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
        >
          Найти
        </button>
      </form>

      <div className="mt-8">
        {courses.length === 0 ? (
          <p className="text-gray-500">
            {query ? 'По вашему запросу ничего не найдено.' : 'Курсы скоро появятся.'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course) => (
              <CatalogCourseCard key={course.id} course={course} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

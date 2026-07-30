import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { getCurrentSchool } from '@/lib/school-context';
import { serverCaller } from '@/server/trpc/caller';
import { CatalogCourseCard } from '@/components/catalog-course-card';

const PAGE_SIZE = 24;

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

/** Мусор и значения < 1 → 1. Итоговая верхняя граница (последняя страница)
 *  применяется отдельно, once we know `total`. */
function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
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

  const { q, page: pageParam } = await searchParams;
  const query = q?.trim() || undefined;
  const requestedPage = parsePage(pageParam);

  const caller = await serverCaller();

  // `total` doesn't depend on the page (the count query has no skip/take),
  // so an out-of-range `?page=` is only knowable after this first call —
  // clamp it and re-fetch once when it was actually out of range.
  const first = await caller.catalog.list({ query, limit: PAGE_SIZE, page: requestedPage });
  const pageCount = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const { items: courses, total } =
    page === requestedPage ? first : await caller.catalog.list({ query, limit: PAGE_SIZE, page });

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const hrefForPage = (targetPage: number): Route => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return (qs ? `/catalog?${qs}` : '/catalog') as Route;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Каталог курсов</h1>
      <p className="mt-1 text-sm text-gray-500">
        {total === 0
          ? 'Курсы не найдены'
          : `Найдено курсов: ${total} · показаны ${rangeStart}–${rangeEnd}`}
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

        {/* Plain <Link>s — no client-side pagination state, so paging works
            with JavaScript disabled just like the search form above. */}
        {pageCount > 1 && (
          <nav
            aria-label="Страницы каталога"
            className="mt-8 flex items-center justify-center gap-4 text-sm"
          >
            {page > 1 ? (
              <Link
                href={hrefForPage(page - 1)}
                className="font-medium text-[var(--brand)] hover:underline"
              >
                ← Назад
              </Link>
            ) : (
              <span className="text-gray-300">← Назад</span>
            )}
            <span className="text-gray-500">
              Страница {page} из {pageCount}
            </span>
            {page < pageCount ? (
              <Link
                href={hrefForPage(page + 1)}
                className="font-medium text-[var(--brand)] hover:underline"
              >
                Вперёд →
              </Link>
            ) : (
              <span className="text-gray-300">Вперёд →</span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { Route } from 'next';
import { auth } from '@/auth';
import { UserRole } from '@parta5/db';
import { getCurrentSchool } from '@/lib/school-context';
import { getFileUrl } from '@/lib/file-url';
import { serverCaller } from '@/server/trpc/caller';
import { CatalogCourseCard } from '@/components/catalog-course-card';

const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.PARENT];

const HOME_COURSE_LIMIT = 12;

/** Self-host with no school resolved yet — this is Парта5's own promo page. */
function PlatformPromo() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900">Парта5</h1>
        <p className="mb-8 text-xl text-gray-600">
          Open-source LMS для школ и учреждений дополнительного образования
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Войти
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-medium text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
          >
            Зарегистрировать школу
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const school = await getCurrentSchool();
  if (!school) {
    return <PlatformPromo />;
  }

  const [session, caller] = await Promise.all([auth(), serverCaller()]);
  const { items: courses, total } = await caller.catalog.list({ limit: HOME_COURSE_LIMIT });
  const schoolLabel = school.displayName ?? school.name;

  const heroCta = session?.user
    ? {
        href: (LEARNER_ROLES.includes(session.user.role) ? '/learn' : '/courses') as Route,
        label: 'Мои курсы',
      }
    : { href: '/login' as Route, label: 'Войти' };

  return (
    <div>
      <section className="bg-[var(--brand)] text-[var(--brand-foreground)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center">
          {school.logoFileAssetId && (
            // Same "white badge" treatment as the footer: a dark-on-transparent
            // logo would disappear against a colored background otherwise.
            <div className="inline-flex items-center rounded-lg bg-white px-4 py-3">
              <img
                src={getFileUrl({ id: school.logoFileAssetId })}
                alt={schoolLabel}
                className="h-12 w-auto"
              />
            </div>
          )}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{schoolLabel}</h1>
          {school.tagline && <p className="max-w-2xl text-lg opacity-90">{school.tagline}</p>}
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={heroCta.href}
              className="rounded-lg bg-white px-6 py-3 text-sm font-medium text-[var(--brand)] transition-opacity hover:opacity-90"
            >
              {heroCta.label}
            </Link>
            <Link
              href="/catalog"
              className="rounded-lg border border-white/70 px-6 py-3 text-sm font-medium transition-colors hover:bg-white/10"
            >
              Все курсы
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Курсы</h2>

        {courses.length === 0 ? (
          <p className="text-gray-500">Курсы скоро появятся</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {courses.map((course) => (
                <CatalogCourseCard key={course.id} course={course} />
              ))}
            </ul>
            {total > HOME_COURSE_LIMIT && (
              <div className="mt-8 text-center">
                <Link
                  href="/catalog"
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  Все курсы ({total})
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

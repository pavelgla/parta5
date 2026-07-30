import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { auth } from '@/auth';
import { getFileUrl } from '@/lib/file-url';
import { stripHtml, truncateText } from '@/lib/strip-html';
import { pluralizeLessons } from '@/lib/pluralize';
import { displayModuleTitle } from '@/lib/module-title';
import { serverCaller } from '@/server/trpc/caller';

interface Props {
  params: Promise<{ courseId: string }>;
}

const META_DESCRIPTION_MAX_LENGTH = 160;

/**
 * Both the page and `generateMetadata` need the course, and a NOT_FOUND
 * course (unpublished, deleted, or belonging to another school) should
 * render Next's 404 rather than bubble up as a 500 in either place.
 */
async function loadCourse(courseId: string) {
  const caller = await serverCaller();
  try {
    return await caller.catalog.getCourse({ courseId });
  } catch (err) {
    if (err instanceof TRPCError) {
      notFound();
    }
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  const course = await loadCourse(courseId);
  const rawDescription = course.shortDescription || course.description;
  return {
    title: course.title,
    description: rawDescription
      ? truncateText(stripHtml(rawDescription), META_DESCRIPTION_MAX_LENGTH)
      : undefined,
  };
}

export default async function CatalogCoursePage({ params }: Props) {
  const { courseId } = await params;
  const [session, course] = await Promise.all([auth(), loadCourse(courseId)]);

  const description = course.shortDescription || course.description;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {course.coverFileAsset && (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-gray-100">
          <img
            src={getFileUrl(course.coverFileAsset)}
            alt={course.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      <h1 className="mt-6 text-3xl font-bold text-gray-900">{course.title}</h1>

      {description && (
        <p className="mt-3 whitespace-pre-line text-gray-600">{stripHtml(description)}</p>
      )}

      {course.modules.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Программа курса</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {course.modules.map((mod, index) => {
              const title = displayModuleTitle(mod.title, index);
              // Moodle imports often title sections "Модуль 1: ...", already
              // carrying the ordinal — don't prefix those with a second,
              // duplicate "Модуль 1 ·" of our own.
              const alreadyNumbered = /^(модуль|раздел)\s/i.test(title);
              return (
                <li key={mod.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="text-sm font-medium text-gray-900">
                    {alreadyNumbered ? title : `Модуль ${index + 1} · ${title}`}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {pluralizeLessons(mod.lessonCount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-8">
        {session?.user ? (
          <Link
            href={`/learn/${course.id}` as Route}
            className="inline-block rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-medium text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
          >
            Перейти к курсу
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-block rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-medium text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
          >
            Войти, чтобы учиться
          </Link>
        )}
      </div>
    </div>
  );
}

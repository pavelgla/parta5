import Link from 'next/link';
import type { Route } from 'next';
import { getFileUrl } from '@/lib/file-url';
import { stripHtml, truncateText } from '@/lib/strip-html';

const DESCRIPTION_MAX_LENGTH = 140;

interface CatalogCourseCardProps {
  course: {
    id: string;
    title: string;
    shortDescription?: string | null;
    description?: string | null;
    coverFileAsset?: { id: string } | null;
  };
}

/**
 * Public storefront card — same rounded/shadow/typography language as
 * `course-card.tsx` (the teacher/student kanban card), but without any of
 * its auth-gated actions (edit, settings, "start learning") since this one
 * renders for anonymous visitors and just links to the course's public page.
 */
export function CatalogCourseCard({ course }: CatalogCourseCardProps) {
  const rawDescription = course.shortDescription || course.description;
  const description = rawDescription
    ? truncateText(stripHtml(rawDescription), DESCRIPTION_MAX_LENGTH)
    : null;

  return (
    <li className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <Link href={`/catalog/${course.id}` as Route} className="flex flex-1 flex-col">
        <div className="relative aspect-[16/9] bg-gray-100">
          {course.coverFileAsset ? (
            <img
              src={getFileUrl(course.coverFileAsset)}
              alt={course.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                className="h-10 w-10 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-5">
          <h2 className="font-semibold text-gray-900 line-clamp-2">{course.title}</h2>
          {description && <p className="text-sm text-gray-500 line-clamp-2">{description}</p>}
          <span className="mt-auto pt-3 text-sm font-medium text-[var(--brand)]">Подробнее →</span>
        </div>
      </Link>
    </li>
  );
}

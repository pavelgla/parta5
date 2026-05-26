import Link from 'next/link';
import type { Route } from 'next';
import { getFileUrl } from '@/lib/file-url';
import { SCHOOL_SUBJECTS } from '@/lib/subjects';

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    slug: string;
    status: string;
    subject?: string | null;
    gradeLevel?: number | null;
    shortDescription?: string | null;
    coverFileAsset?: { key: string } | null;
  };
  variant: 'teacher' | 'student';
}

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'Архив',
  DRAFT: 'Черновик',
};

const STATUS_CLASS: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
  DRAFT: 'bg-yellow-100 text-yellow-700',
};

export function CourseCard({ course, variant }: CourseCardProps) {
  const subjectLabel = course.subject
    ? SCHOOL_SUBJECTS.find((s) => s.id === course.subject)?.label
    : null;
  const badge = [subjectLabel, course.gradeLevel ? `${course.gradeLevel} класс` : null]
    .filter(Boolean)
    .join(' • ');

  return (
    <li className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Cover image */}
      <div className="relative aspect-video bg-gray-100">
        {course.coverFileAsset ? (
          <img
            src={getFileUrl(course.coverFileAsset)}
            alt={course.title}
            className="h-full w-full object-cover"
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
        {/* Status badge overlay */}
        <span
          className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[course.status] ?? STATUS_CLASS.DRAFT}`}
        >
          {STATUS_LABEL[course.status] ?? course.status}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="font-semibold text-gray-900 line-clamp-2">{course.title}</h2>

        {badge && <span className="text-xs text-gray-500 font-medium">{badge}</span>}

        {course.shortDescription && (
          <p className="text-sm text-gray-500 line-clamp-2">{course.shortDescription}</p>
        )}

        {/* Actions */}
        <div className="mt-auto pt-3 flex gap-3">
          {variant === 'teacher' ? (
            <>
              <Link
                href={`/courses/${course.id}/edit` as Route}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Редактировать
              </Link>
              <Link
                href={`/courses/${course.id}/edit/settings` as Route}
                className="text-sm font-medium text-gray-500 hover:underline"
              >
                Настройки
              </Link>
            </>
          ) : (
            <Link
              href={`/learn/${course.id}` as Route}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Начать обучение
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

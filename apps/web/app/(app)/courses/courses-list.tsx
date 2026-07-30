'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/react';
import { CourseCard } from '@/components/course-card';

interface CourseListItem {
  id: string;
  title: string;
  status: string;
  subject?: string | null;
  gradeLevel?: number | null;
  shortDescription?: string | null;
  coverFileAsset?: { id: string } | null;
}

interface SkippedItem {
  id: string;
  title: string;
  issues: Array<{ path: string; message: string }>;
}

interface PublishSummary {
  publishedCount: number;
  skippedCount: number;
  skipped: SkippedItem[];
}

interface Props {
  courses: CourseListItem[];
}

/**
 * Массовая публикация черновиков (S13): импортёр создаёт курсы черновиками,
 * и заполнять «Краткое описание» вручную под сотню курсов нереально для
 * учебных центров. Панель выбора появляется только если есть черновики.
 */
export function CoursesList({ courses: initialCourses }: Props) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<PublishSummary | null>(null);
  const [showSkippedDetails, setShowSkippedDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishMany = trpc.course.publishMany.useMutation();

  const draftIds = useMemo(
    () => courses.filter((c) => c.status === 'DRAFT').map((c) => c.id),
    [courses],
  );
  const allDraftsSelected = draftIds.length > 0 && draftIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllDrafts() {
    setSelected(allDraftsSelected ? new Set() : new Set(draftIds));
  }

  async function handlePublishSelected() {
    if (selected.size === 0) return;
    setError(null);
    setSummary(null);
    const ids = Array.from(selected);
    try {
      const result = await publishMany.mutateAsync({ ids });
      setSummary(result);
      const skippedIds = new Set(result.skipped.map((s) => s.id));
      setCourses((prev) =>
        prev.map((c) =>
          ids.includes(c.id) && !skippedIds.has(c.id) ? { ...c, status: 'PUBLISHED' } : c,
        ),
      );
      // Оставляем выбранными только те, что не опубликовались — удобно
      // поправить и повторить попытку.
      setSelected(skippedIds);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать выбранные курсы');
    }
  }

  if (courses.length === 0) {
    return (
      <div className="mt-12 text-center">
        <p className="text-gray-500">Нет курсов. Создайте первый!</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {draftIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allDraftsSelected}
              onChange={toggleSelectAllDrafts}
              className="h-4 w-4 accent-blue-600"
            />
            Выбрать все черновики ({draftIds.length})
          </label>
          <button
            type="button"
            disabled={selected.size === 0 || publishMany.isPending}
            onClick={handlePublishSelected}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {publishMany.isPending ? 'Публикуем…' : `Опубликовать выбранные (${selected.size})`}
          </button>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <p className="font-medium text-gray-900">
            Опубликовано {summary.publishedCount}, пропущено {summary.skippedCount}
          </p>
          {summary.skipped.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowSkippedDetails((v) => !v)}
                className="mt-1 font-medium text-blue-600 hover:underline"
              >
                {showSkippedDetails ? 'Скрыть причины' : 'Показать причины'}
              </button>
              {showSkippedDetails && (
                <ul className="mt-2 space-y-2">
                  {summary.skipped.map((s) => (
                    <li key={s.id} className="break-words">
                      <span className="font-medium text-gray-800">{s.title || 'Курс'}</span>
                      <ul className="list-disc pl-5 text-red-600">
                        {s.issues.map((issue, i) => (
                          <li key={i}>{issue.message}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            variant="teacher"
            selectable={course.status === 'DRAFT'}
            selected={selected.has(course.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </ul>
    </div>
  );
}

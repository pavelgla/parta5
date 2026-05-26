'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/react';
import { SCHOOL_SUBJECTS, type SubjectId } from '@/lib/subjects';
import { getFileUrl } from '@/lib/file-url';
import { TipTapEditor } from '@/components/tiptap/editor';
import { FileUpload } from '@/components/file-upload';

interface CoverAsset {
  id: string;
  key: string;
}

type LongDescJson = { html: string };

interface Course {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt?: Date | string | null;
  subject?: string | null;
  gradeLevel?: number | null;
  shortDescription?: string | null;
  longDescription?: LongDescJson | null;
  coverFileAsset?: CoverAsset | null;
}

interface Props {
  course: Course;
}

function extractHtml(longDescription: LongDescJson | null | undefined): string {
  if (!longDescription) return '';
  return longDescription.html;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'Архив',
  DRAFT: 'Черновик',
};

const STATUS_CLASS: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-orange-100 text-orange-700',
  DRAFT: 'bg-gray-100 text-gray-600',
};

const VALIDATION_CHECKS = [
  { path: 'title', label: 'Название курса заполнено' },
  { path: 'shortDescription', label: 'Краткое описание заполнено' },
  { path: 'subject', label: 'Предмет выбран' },
  { path: 'gradeLevel', label: 'Класс указан (5–11)' },
  { path: 'cover', label: 'Обложка загружена' },
  { path: 'modules', label: 'Есть хотя бы один модуль' },
];

export function CourseSettingsForm({ course }: Props) {
  const updateMutation = trpc.course.update.useMutation();
  const publishMutation = trpc.course.publish.useMutation();
  const unpublishMutation = trpc.course.unpublish.useMutation();
  const archiveMutation = trpc.course.archive.useMutation();

  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);
  const [subject, setSubject] = useState<string>(course.subject ?? '');
  const [gradeLevel, setGradeLevel] = useState<string>(
    course.gradeLevel != null ? String(course.gradeLevel) : '',
  );
  const [shortDescription, setShortDescription] = useState(course.shortDescription ?? '');
  const [longDescHtml, setLongDescHtml] = useState(() => extractHtml(course.longDescription));
  const [coverAsset, setCoverAsset] = useState<CoverAsset | null>(course.coverFileAsset ?? null);

  const [formStatus, setFormStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentStatus, setCurrentStatus] = useState<string>(course.status);
  const [currentPublishedAt, setCurrentPublishedAt] = useState<Date | string | null | undefined>(
    course.publishedAt,
  );

  const { data: issues = [], refetch: refetchIssues } = trpc.course.validate.useQuery({
    id: course.id,
  });

  const SHORT_DESC_MAX = 200;
  const remainingChars = SHORT_DESC_MAX - shortDescription.length;

  const hasIssues = issues.length > 0;

  const dynamicIssues = issues.filter((i) => !VALIDATION_CHECKS.some((c) => c.path === i.path));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormStatus('saving');
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Название курса не может быть пустым');
      setFormStatus('error');
      return;
    }
    if (!slug.trim()) {
      setErrorMessage('Slug не может быть пустым');
      setFormStatus('error');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: course.id,
        title: title.trim(),
        slug: slug.trim(),
        subject: (subject || null) as SubjectId | null | undefined,
        gradeLevel: gradeLevel ? parseInt(gradeLevel, 10) : null,
        shortDescription: shortDescription.trim() || null,
        longDescription: longDescHtml ? { html: longDescHtml } : null,
        coverFileAssetId: coverAsset?.id ?? null,
      });
      setFormStatus('success');
      setTimeout(() => setFormStatus('idle'), 2500);
      void refetchIssues();
    } catch (err) {
      setFormStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Произошла ошибка при сохранении');
    }
  }

  async function handleCoverUploaded(asset: { id: string; key: string }) {
    setCoverAsset(asset);
    try {
      await updateMutation.mutateAsync({ id: course.id, coverFileAssetId: asset.id });
      void refetchIssues();
    } catch {
      // Non-critical — will be saved on main form submit too
    }
  }

  async function handlePublish() {
    try {
      const updated = await publishMutation.mutateAsync({ id: course.id });
      setCurrentStatus(updated.status);
      setCurrentPublishedAt(updated.publishedAt);
      void refetchIssues();
    } catch {
      // Error state managed by publishMutation.error
    }
  }

  async function handleUnpublish() {
    try {
      const updated = await unpublishMutation.mutateAsync({ id: course.id });
      setCurrentStatus(updated.status);
    } catch {
      // Error state managed by unpublishMutation.error
    }
  }

  async function handleArchive() {
    if (
      !confirm(
        'Архивировать курс? Он станет недоступен для записи, но ученики смогут продолжить обучение.',
      )
    )
      return;
    try {
      const updated = await archiveMutation.mutateAsync({ id: course.id });
      setCurrentStatus(updated.status);
    } catch {
      // Error state managed by archiveMutation.error
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Название курса"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL-адрес (slug) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          maxLength={100}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="url-kursa"
        />
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Предмет</label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— не указан —</option>
          {SCHOOL_SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grade Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Класс</label>
        <select
          value={gradeLevel}
          onChange={(e) => setGradeLevel(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— не указан —</option>
          {[5, 6, 7, 8, 9, 10, 11].map((g) => (
            <option key={g} value={g}>
              {g} класс
            </option>
          ))}
        </select>
      </div>

      {/* Short Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Краткое описание</label>
        <input
          type="text"
          value={shortDescription}
          onChange={(e) => {
            if (e.target.value.length <= SHORT_DESC_MAX) setShortDescription(e.target.value);
          }}
          maxLength={SHORT_DESC_MAX}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Одна-две фразы о курсе"
        />
        <p className={`mt-1 text-xs ${remainingChars < 20 ? 'text-orange-500' : 'text-gray-400'}`}>
          Осталось символов: {remainingChars}
        </p>
      </div>

      {/* Long Description (TipTap) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Полное описание</label>
        <div className="rounded-lg border border-gray-300 px-3 py-2 min-h-[120px] focus-within:ring-2 focus-within:ring-blue-500">
          <TipTapEditor
            content={longDescHtml}
            onChange={(html) => setLongDescHtml(html)}
            placeholder="Подробное описание курса, цели, требования..."
          />
        </div>
      </div>

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Обложка курса</label>
        {coverAsset && (
          <div className="mb-3">
            <img
              src={getFileUrl(coverAsset)}
              alt="Обложка курса"
              className="h-40 w-full rounded-lg object-cover border border-gray-200"
            />
          </div>
        )}
        <FileUpload accept="image/*" maxSizeMB={5} onUploaded={handleCoverUploaded} />
      </div>

      {/* Save Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={formStatus === 'saving'}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {formStatus === 'saving' ? 'Сохранение...' : 'Сохранить'}
        </button>

        {formStatus === 'success' && (
          <span className="text-sm text-green-600">Настройки сохранены</span>
        )}
        {formStatus === 'error' && errorMessage && (
          <span className="text-sm text-red-500">{errorMessage}</span>
        )}
      </div>

      {/* Publication Section */}
      <div className="border-t border-gray-200 pt-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Публикация</h3>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">Статус:</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[currentStatus] ?? STATUS_CLASS.DRAFT}`}
          >
            {STATUS_LABEL[currentStatus] ?? currentStatus}
          </span>
          {currentPublishedAt && (
            <span className="text-xs text-gray-400">
              Опубликовано: {formatDate(currentPublishedAt)}
            </span>
          )}
        </div>

        {/* Validation checklist */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
          {VALIDATION_CHECKS.map((check) => {
            const issue = issues.find((i) => i.path === check.path);
            return (
              <div key={check.path} className="flex items-start gap-2 text-sm">
                {issue ? (
                  <>
                    <span className="text-red-500 shrink-0">✗</span>
                    <span className="text-red-600">{issue.message}</span>
                  </>
                ) : (
                  <>
                    <span className="text-green-600 shrink-0">✓</span>
                    <span className="text-gray-600">{check.label}</span>
                  </>
                )}
              </div>
            );
          })}
          {dynamicIssues.length > 0 && (
            <>
              {dynamicIssues.map((issue) => (
                <div key={issue.path} className="flex items-start gap-2 text-sm">
                  <span className="text-red-500 shrink-0">✗</span>
                  <span className="text-red-600">{issue.message}</span>
                </div>
              ))}
            </>
          )}
          {!hasIssues && dynamicIssues.length === 0 && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-green-600 shrink-0">✓</span>
              <span className="text-gray-600">Структура курса заполнена</span>
            </div>
          )}
        </div>

        {publishMutation.isError && hasIssues && (
          <p className="text-sm text-red-600">Исправьте ошибки перед публикацией</p>
        )}

        <div className="flex flex-wrap gap-3">
          {currentStatus !== 'PUBLISHED' && (
            <button
              type="button"
              disabled={hasIssues || publishMutation.isPending}
              onClick={handlePublish}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {publishMutation.isPending ? 'Публикуем...' : 'Опубликовать'}
            </button>
          )}
          {currentStatus === 'PUBLISHED' && (
            <button
              type="button"
              disabled={unpublishMutation.isPending}
              onClick={handleUnpublish}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {unpublishMutation.isPending ? 'Снимаем...' : 'Снять с публикации'}
            </button>
          )}
          {currentStatus !== 'ARCHIVED' && (
            <button
              type="button"
              disabled={archiveMutation.isPending}
              onClick={handleArchive}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {archiveMutation.isPending ? 'Архивируем...' : 'Архивировать'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

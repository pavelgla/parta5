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

export function CourseSettingsForm({ course }: Props) {
  const updateMutation = trpc.course.update.useMutation();

  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);
  const [subject, setSubject] = useState<string>(course.subject ?? '');
  const [gradeLevel, setGradeLevel] = useState<string>(
    course.gradeLevel != null ? String(course.gradeLevel) : '',
  );
  const [shortDescription, setShortDescription] = useState(course.shortDescription ?? '');
  const [longDescHtml, setLongDescHtml] = useState(() => extractHtml(course.longDescription));
  const [coverAsset, setCoverAsset] = useState<CoverAsset | null>(course.coverFileAsset ?? null);

  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const SHORT_DESC_MAX = 200;
  const remainingChars = SHORT_DESC_MAX - shortDescription.length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Название курса не может быть пустым');
      setStatus('error');
      return;
    }
    if (!slug.trim()) {
      setErrorMessage('Slug не может быть пустым');
      setStatus('error');
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
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Произошла ошибка при сохранении');
    }
  }

  async function handleCoverUploaded(asset: { id: string; key: string }) {
    setCoverAsset(asset);
    // Save cover immediately
    try {
      await updateMutation.mutateAsync({ id: course.id, coverFileAssetId: asset.id });
    } catch {
      // Non-critical — will be saved on main form submit too
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

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {status === 'saving' ? 'Сохранение...' : 'Сохранить'}
        </button>

        {status === 'success' && (
          <span className="text-sm text-green-600">Настройки сохранены</span>
        )}
        {status === 'error' && errorMessage && (
          <span className="text-sm text-red-500">{errorMessage}</span>
        )}
      </div>
    </form>
  );
}

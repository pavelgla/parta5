'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { trpc } from '@/lib/trpc/react';
import { FileUpload } from '@/components/file-upload';

interface SkippedActivity {
  modulename: string;
  title: string;
  reason: string;
}

interface ImportReport {
  courseTitle: string;
  courseSlug: string | null;
  modules: number;
  lessons: number;
  blocks: number;
  files: { count: number; totalBytes: number };
  skippedActivities: SkippedActivity[];
  warnings: string[];
  quizzes: number;
  questions: { imported: number; skippedByType: Record<string, number> };
}

type Stage = 'idle' | 'uploaded' | 'queued' | 'running' | 'done' | 'failed';

export function ImportCourseForm() {
  const [stage, setStage] = useState<Stage>('idle');
  const [fileAssetId, setFileAssetId] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createImport = trpc.import.create.useMutation();
  const utils = trpc.useUtils();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!importId || (stage !== 'queued' && stage !== 'running')) return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await utils.import.byId.fetch({ id: importId });
        const data = result as unknown as {
          status: string;
          report: unknown;
          error: string | null;
          courseId: string | null;
        };
        if (data.status === 'DONE') {
          stopPolling();
          setStage('done');
          setReport(data.report as ImportReport);
          setCourseId(data.courseId);
        } else if (data.status === 'FAILED') {
          stopPolling();
          setStage('failed');
          setError(data.error ?? 'Импорт завершился ошибкой');
        } else if (data.status === 'RUNNING') {
          setStage('running');
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return stopPolling;
  }, [importId, stage, utils, stopPolling]);

  async function handleStartImport() {
    if (!fileAssetId) return;
    setError(null);

    try {
      const result = await createImport.mutateAsync({ fileAssetId });
      setImportId(result.id);
      setStage('queued');
    } catch (err) {
      setStage('failed');
      setError(err instanceof Error ? err.message : 'Не удалось запустить импорт');
    }
  }

  const stageLabel: Record<Stage, string> = {
    idle: '',
    uploaded: '',
    queued: 'В очереди…',
    running: 'Импортируется…',
    done: 'Готово',
    failed: 'Ошибка',
  };

  return (
    <div className="space-y-4">
      {(stage === 'idle' || stage === 'uploaded') && (
        <>
          <FileUpload
            accept=".mbz"
            maxSizeMB={50}
            onUploaded={(asset) => {
              setFileAssetId(asset.id);
              setStage('uploaded');
            }}
          />
          <button
            type="button"
            disabled={!fileAssetId || createImport.isPending}
            onClick={handleStartImport}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createImport.isPending ? 'Запуск…' : 'Импортировать'}
          </button>
        </>
      )}

      {(stage === 'queued' || stage === 'running') && (
        <p className="text-sm text-center text-gray-600">{stageLabel[stage]}</p>
      )}

      {stage === 'done' && report && (
        <div className="space-y-3 text-sm">
          <p className="font-medium text-green-700">Курс «{report.courseTitle}» импортирован</p>
          <ul className="space-y-1 text-gray-600">
            <li>Модулей: {report.modules}</li>
            <li>Уроков: {report.lessons}</li>
            <li>Блоков контента: {report.blocks}</li>
            <li>
              Файлов: {report.files.count} ({Math.round(report.files.totalBytes / 1024 / 1024)} МБ)
            </li>
            <li>
              Тестов: {report.quizzes}, вопросов импортировано: {report.questions.imported}
            </li>
          </ul>

          {Object.keys(report.questions.skippedByType).length > 0 && (
            <div>
              <p className="font-medium text-gray-700">Пропущено вопросов по типу:</p>
              <ul className="list-disc pl-5 text-gray-500">
                {Object.entries(report.questions.skippedByType).map(([type, count]) => (
                  <li key={type}>
                    {type}: {count}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.skippedActivities.length > 0 && (
            <div>
              <p className="font-medium text-gray-700">Пропущенные элементы:</p>
              <ul className="list-disc pl-5 text-gray-500">
                {report.skippedActivities.map((a, i) => (
                  <li key={i}>
                    {a.title} ({a.modulename}) — {a.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div>
              <p className="font-medium text-amber-700">Предупреждения:</p>
              <ul className="list-disc pl-5 text-amber-600">
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {courseId && (
            <Link
              href={`/courses/${courseId}/edit` as Route}
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Открыть курс
            </Link>
          )}
        </div>
      )}

      {stage === 'failed' && error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

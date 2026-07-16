'use client';

import { useState } from 'react';
import { isPassed, scorePercent } from '@parta5/quiz';
import { trpcClient } from '@/lib/trpc/client';

interface QuizColumn {
  quizId: string;
  title: string;
  lessonTitle: string;
  passingScore: number | null;
}

interface Cell {
  quizId: string;
  bestScore: number | null;
  maxScore: number | null;
  attempts: number;
  lastAt: Date | string | null;
}

interface Row {
  userId: string;
  userName: string;
  cells: Cell[];
}

interface Props {
  courseId: string;
  courseSlug: string;
  gradebook: { quizzes: QuizColumn[]; rows: Row[] };
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function GradebookCell({ cell, passingScore }: { cell: Cell; passingScore: number | null }) {
  if (cell.attempts === 0 || cell.bestScore == null || cell.maxScore == null) {
    return <span className="text-gray-300">—</span>;
  }

  const percent = scorePercent(cell.bestScore, cell.maxScore);
  const passed = isPassed(cell.bestScore, cell.maxScore, passingScore) ?? false;

  return (
    <div
      title={
        cell.lastAt
          ? `Последняя попытка: ${new Date(cell.lastAt).toLocaleString('ru-RU')}`
          : undefined
      }
    >
      <span className="text-gray-900">
        {formatScore(cell.bestScore)}/{formatScore(cell.maxScore)}
      </span>{' '}
      <span className={passed ? 'font-medium text-green-600' : 'text-gray-500'}>{percent}%</span>
      <div className="text-xs text-gray-400">{cell.attempts} поп.</div>
    </div>
  );
}

export function GradebookTable({ courseId, courseSlug, gradebook }: Props) {
  const [exporting, setExporting] = useState(false);
  const { quizzes, rows } = gradebook;

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await trpcClient.gradebook.csvForCourse.query({ courseId });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gradebook-${courseSlug}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Экспорт…' : 'Экспорт CSV'}
        </button>
      </div>

      {quizzes.length === 0 ? (
        <p className="text-sm text-gray-500">В курсе пока нет тестов.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">На курс пока никто не зачислен.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">
                  Ученик
                </th>
                {quizzes.map((q) => (
                  <th
                    key={q.quizId}
                    className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700"
                  >
                    {q.title}
                    <div className="text-xs font-normal text-gray-400">{q.lessonTitle}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-gray-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {row.userName}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={cell.quizId} className="px-4 py-3 whitespace-nowrap">
                      <GradebookCell cell={cell} passingScore={quizzes[i].passingScore} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc/react';

interface CourseOption {
  id: string;
  title: string;
}

interface RosterError {
  line: number;
  reason: string;
}

interface Credential {
  email: string;
  password: string;
}

interface ImportResult {
  created: number;
  existing: number;
  credentials: Credential[];
  parseErrors: RosterError[];
}

interface Props {
  courses: CourseOption[];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function downloadCredentialsCsv(credentials: Credential[]) {
  const header = 'email,password\n';
  const body = credentials.map((c) => `${c.email},${c.password}`).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'parta5-passwords.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportRosterForm({ courses }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('');
  const [readError, setReadError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importRoster = trpc.user.importRoster.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => setReadError(err.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReadError(null);
    setResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        setFileBase64(arrayBufferToBase64(reader.result));
      }
    };
    reader.onerror = () => setReadError('Не удалось прочитать файл');
    reader.readAsArrayBuffer(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileBase64) {
      setReadError('Выберите файл CSV');
      return;
    }
    setReadError(null);
    importRoster.mutate({
      fileBase64,
      courseId: courseId || undefined,
    });
  }

  function handleReset() {
    setFileName(null);
    setFileBase64(null);
    setCourseId('');
    setResult(null);
    setReadError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (result) {
    return (
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Результат импорта</h2>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>Создано новых пользователей: {result.created}</li>
          <li>Уже существовало: {result.existing}</li>
        </ul>

        {result.parseErrors.length > 0 && (
          <div>
            <p className="text-sm font-medium text-red-700">
              Ошибки в строках ({result.parseErrors.length}):
            </p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500">
                      Строка
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500">
                      Причина
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.parseErrors.map((e, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{e.line}</td>
                      <td className="px-3 py-2 text-red-600">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result.credentials.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              Пароли показываются только один раз. Обязательно сохраните файл сейчас — повторно их
              получить будет нельзя.
            </p>
            <button
              type="button"
              onClick={() => downloadCredentialsCsv(result.credentials)}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Скачать пароли (CSV)
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Импортировать ещё один файл
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700">Файл CSV</label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        {fileName && <p className="mt-1 text-xs text-gray-500">Выбран файл: {fileName}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Зачислить на курс <span className="font-normal text-gray-400">(необязательно)</span>
        </label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Не зачислять</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {readError && <p className="text-sm text-red-600">{readError}</p>}

      <button
        type="submit"
        disabled={!fileBase64 || importRoster.isPending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {importRoster.isPending ? 'Импортируем…' : 'Импортировать'}
      </button>
    </form>
  );
}

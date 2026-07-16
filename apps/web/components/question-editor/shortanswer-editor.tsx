'use client';

import type { ShortanswerData } from './types';

interface Props {
  data: ShortanswerData;
  onChange: (data: ShortanswerData) => void;
  error?: string;
}

export function ShortanswerEditor({ data, onChange, error }: Props) {
  function updateAnswer(idx: number, value: string) {
    onChange({
      ...data,
      acceptedAnswers: data.acceptedAnswers.map((a, i) => (i === idx ? value : a)),
    });
  }

  function addAnswer() {
    onChange({ ...data, acceptedAnswers: [...data.acceptedAnswers, ''] });
  }

  function removeAnswer(idx: number) {
    if (data.acceptedAnswers.length <= 1) return;
    onChange({ ...data, acceptedAnswers: data.acceptedAnswers.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {data.acceptedAnswers.map((answer, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={answer}
              onChange={(e) => updateAnswer(idx, e.target.value)}
              placeholder={`Принимаемый ответ ${idx + 1}`}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeAnswer(idx)}
              disabled={data.acceptedAnswers.length <= 1}
              className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300 text-lg leading-none"
              title="Удалить ответ"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={addAnswer}
        className="text-sm font-medium text-blue-600 hover:underline"
      >
        + Добавить ответ
      </button>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={data.caseSensitive}
          onChange={(e) => onChange({ ...data, caseSensitive: e.target.checked })}
        />
        Учитывать регистр букв
      </label>
    </div>
  );
}

'use client';

import type { QuestionData } from './types';

interface Props {
  data: QuestionData;
}

export function QuestionPreview({ data }: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <p className="whitespace-pre-wrap text-sm text-gray-900">
        {data.prompt || <span className="text-gray-400">Текст вопроса…</span>}
      </p>

      {data.type === 'MULTICHOICE' && (
        <div className="space-y-2">
          {data.choices.map((choice) => (
            <label key={choice.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input type={data.single ? 'radio' : 'checkbox'} name="preview-choice" disabled />
              {choice.text || <span className="text-gray-400">Вариант…</span>}
            </label>
          ))}
        </div>
      )}

      {data.type === 'TRUEFALSE' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="radio" name="preview-tf" disabled />
            Верно
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="radio" name="preview-tf" disabled />
            Неверно
          </label>
        </div>
      )}

      {data.type === 'SHORTANSWER' && (
        <input
          type="text"
          disabled
          placeholder="Ответ студента…"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-400"
        />
      )}
    </div>
  );
}

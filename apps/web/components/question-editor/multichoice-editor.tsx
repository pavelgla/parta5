'use client';

import { makeChoiceId, type Choice, type MultichoiceData } from './types';

interface Props {
  data: MultichoiceData;
  onChange: (data: MultichoiceData) => void;
  error?: string;
}

export function MultichoiceEditor({ data, onChange, error }: Props) {
  function updateChoice(id: string, patch: Partial<Choice>) {
    onChange({
      ...data,
      choices: data.choices.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function toggleCorrect(id: string) {
    if (data.single) {
      onChange({
        ...data,
        choices: data.choices.map((c) => ({ ...c, correct: c.id === id })),
      });
    } else {
      updateChoice(id, { correct: !data.choices.find((c) => c.id === id)?.correct });
    }
  }

  function addChoice() {
    onChange({
      ...data,
      choices: [...data.choices, { id: makeChoiceId(), text: '', correct: false }],
    });
  }

  function removeChoice(id: string) {
    if (data.choices.length <= 2) return;
    onChange({ ...data, choices: data.choices.filter((c) => c.id !== id) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="single-mode"
            checked={data.single}
            onChange={() => {
              const firstCorrect = data.choices.find((c) => c.correct)?.id ?? data.choices[0]?.id;
              onChange({
                ...data,
                single: true,
                choices: data.choices.map((c) => ({ ...c, correct: c.id === firstCorrect })),
              });
            }}
          />
          Один правильный ответ
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="single-mode"
            checked={!data.single}
            onChange={() => onChange({ ...data, single: false })}
          />
          Несколько правильных ответов
        </label>
      </div>

      <div className="space-y-2">
        {data.choices.map((choice, idx) => (
          <div
            key={choice.id}
            className="flex items-start gap-2 rounded-lg border border-gray-200 p-2"
          >
            <input
              type={data.single ? 'radio' : 'checkbox'}
              name="correct-choice"
              checked={choice.correct}
              onChange={() => toggleCorrect(choice.id)}
              className="mt-2"
              title="Верный вариант"
            />
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={choice.text}
                onChange={(e) => updateChoice(choice.id, { text: e.target.value })}
                placeholder={`Вариант ${idx + 1}`}
                className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                value={choice.feedback ?? ''}
                onChange={(e) => updateChoice(choice.id, { feedback: e.target.value })}
                placeholder="Комментарий (необязательно)"
                className="block w-full rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => removeChoice(choice.id)}
              disabled={data.choices.length <= 2}
              className="mt-1.5 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300 text-lg leading-none"
              title="Удалить вариант"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={addChoice}
        className="text-sm font-medium text-blue-600 hover:underline"
      >
        + Добавить вариант
      </button>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={data.shuffleChoices}
          onChange={(e) => onChange({ ...data, shuffleChoices: e.target.checked })}
        />
        Перемешивать варианты при показе
      </label>
    </div>
  );
}

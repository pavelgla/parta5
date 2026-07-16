'use client';

import type { TruefalseData } from './types';

interface Props {
  data: TruefalseData;
  onChange: (data: TruefalseData) => void;
}

export function TruefalseEditor({ data, onChange }: Props) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name="correct-answer"
          checked={data.correctAnswer}
          onChange={() => onChange({ ...data, correctAnswer: true })}
        />
        Верно
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name="correct-answer"
          checked={!data.correctAnswer}
          onChange={() => onChange({ ...data, correctAnswer: false })}
        />
        Неверно
      </label>
    </div>
  );
}

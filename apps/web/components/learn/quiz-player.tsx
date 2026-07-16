'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import { ListChecks } from 'lucide-react';
import { isPassed, scorePercent } from '@parta5/quiz';
import { trpc } from '@/lib/trpc/react';
import type { attemptRouter } from '@/server/routers/attempt';

type RouterOutputs = inferRouterOutputs<typeof attemptRouter>;
type AttemptSnapshot = NonNullable<RouterOutputs['active']>;
type AttemptQuestion = AttemptSnapshot['questions'][number];
type SubmitResult = Omit<RouterOutputs['submit'], 'status'> & {
  status: 'SUBMITTED' | 'EXPIRED';
};
type GradedItem = SubmitResult['items'][number];
type QuestionData = GradedItem['data'];
type SanitizedQuestionData = AttemptQuestion['data'];

interface Props {
  quizId: string;
  title: string;
}

function isAnswered(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  if ('choiceIds' in value) return (value as { choiceIds: string[] }).choiceIds.length > 0;
  if ('text' in value) return (value as { text: string }).text.trim().length > 0;
  if ('value' in value) return (value as { value: boolean }).value != null;
  return false;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Question prompt/choice text is HTML sanitized at write time (importer +
 * questionBank router), so raw untrusted input never reaches this component.
 */
function QuestionHtml({
  html,
  className,
  testId,
}: {
  html: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function QuizPlayer({ quizId, title }: Props) {
  const [attempt, setAttempt] = useState<AttemptSnapshot | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const summary = trpc.attempt.summary.useQuery({ quizId });
  const active = trpc.attempt.active.useQuery({ quizId }, { enabled: !attempt && !result });
  const startMutation = trpc.attempt.start.useMutation();

  function handleStart() {
    startMutation.mutate({ quizId }, { onSuccess: (data) => setAttempt(data as AttemptSnapshot) });
  }

  function handleContinue() {
    if (active.data) setAttempt(active.data);
  }

  function handleSubmitted(data: SubmitResult) {
    setAttempt(null);
    setResult(data);
    void summary.refetch();
  }

  function handleRetry() {
    setResult(null);
    setAttempt(null);
  }

  if (result) {
    const attemptsUsed = summary.data?.attemptsUsed ?? 0;
    const maxAttempts = summary.data?.maxAttempts ?? null;
    const canRetry = maxAttempts == null || attemptsUsed < maxAttempts;
    return <QuizResult result={result} canRetry={canRetry} onRetry={handleRetry} />;
  }

  if (attempt) {
    return <QuizRunner attempt={attempt} onSubmitted={handleSubmitted} />;
  }

  return (
    <QuizCard
      title={title}
      attemptsUsed={summary.data?.attemptsUsed ?? 0}
      maxAttempts={summary.data?.maxAttempts ?? null}
      lastScore={summary.data?.lastScore ?? null}
      hasActive={!!active.data}
      loading={summary.isLoading || active.isLoading}
      starting={startMutation.isPending}
      onStart={handleStart}
      onContinue={handleContinue}
    />
  );
}

function QuizCard({
  title,
  attemptsUsed,
  maxAttempts,
  lastScore,
  hasActive,
  loading,
  starting,
  onStart,
  onContinue,
}: {
  title: string;
  attemptsUsed: number;
  maxAttempts: number | null;
  lastScore: { score: number | null; maxScore: number } | null;
  hasActive: boolean;
  loading: boolean;
  starting: boolean;
  onStart: () => void;
  onContinue: () => void;
}) {
  const canStart = hasActive || maxAttempts == null || attemptsUsed < maxAttempts;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <ListChecks size={20} className="shrink-0 text-gray-400" />
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>

      <div className="space-y-1 text-sm text-gray-500">
        {maxAttempts != null && (
          <p>
            Попыток использовано: {attemptsUsed} из {maxAttempts}
          </p>
        )}
        {lastScore && (
          <p>
            Последний результат: {lastScore.score ?? 0} из {lastScore.maxScore}
          </p>
        )}
      </div>

      {!canStart ? (
        <p className="text-sm font-medium text-red-600">Достигнут лимит попыток</p>
      ) : (
        <button
          type="button"
          data-testid="quiz-start-button"
          onClick={hasActive ? onContinue : onStart}
          disabled={loading || starting}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {starting ? 'Загрузка…' : hasActive ? 'Продолжить' : 'Начать тест'}
        </button>
      )}
    </div>
  );
}

function QuizRunner({
  attempt,
  onSubmitted,
}: {
  attempt: AttemptSnapshot;
  onSubmitted: (result: SubmitResult) => void;
}) {
  const sorted = useMemo<AttemptQuestion[]>(
    () => [...attempt.questions].sort((a, b) => a.order - b.order),
    [attempt],
  );

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const q of sorted) {
      if (q.answer != null) initial[q.questionId] = q.answer;
    }
    return initial;
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const answerMutation = trpc.attempt.answer.useMutation();
  const submitMutation = trpc.attempt.submit.useMutation();
  const expiredResultQuery = trpc.attempt.byId.useQuery(
    { id: attempt.id },
    { enabled: expiredNotice },
  );

  const offsetRef = useRef(new Date(attempt.serverNow).getTime() - Date.now());
  const expiresAtMs = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : null;
  const [remainingMs, setRemainingMs] = useState<number | null>(
    expiresAtMs != null ? expiresAtMs - (Date.now() + offsetRef.current) : null,
  );

  const submittingRef = useRef(false);

  function doSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    submitMutation.mutate(
      { attemptId: attempt.id },
      {
        onSuccess: (data) => onSubmitted(data),
        onError: () => {
          submittingRef.current = false;
        },
      },
    );
  }

  useEffect(() => {
    if (expiresAtMs == null) return;
    const id = setInterval(() => {
      const remaining = expiresAtMs - (Date.now() + offsetRef.current);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        doSubmit();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAtMs]);

  useEffect(() => {
    const data = expiredResultQuery.data;
    if (data && data.status !== 'IN_PROGRESS') {
      onSubmitted(data as SubmitResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiredResultQuery.data]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flushSave(questionId: string, value: unknown) {
    setSaveState('saving');
    answerMutation.mutate(
      { attemptId: attempt.id, questionId, answer: value },
      {
        onSuccess: () => setSaveState('saved'),
        onError: (error) => {
          if (error.data?.code === 'FORBIDDEN') {
            setExpiredNotice(true);
          }
        },
      },
    );
  }

  function updateAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSaveState('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flushSave(questionId, value), 500);
  }

  function flushPending() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      const current = sorted[index];
      if (current && answers[current.questionId] !== undefined) {
        flushSave(current.questionId, answers[current.questionId]);
      }
    }
  }

  function goTo(newIndex: number) {
    flushPending();
    setIndex(newIndex);
  }

  const current = sorted[index];
  const unansweredNumbers: number[] = [];
  sorted.forEach((q, i) => {
    if (!isAnswered(answers[q.questionId])) unansweredNumbers.push(i + 1);
  });

  function handleSubmitClick() {
    flushPending();
    setConfirmOpen(true);
  }

  function confirmSubmit() {
    setConfirmOpen(false);
    doSubmit();
  }

  if (expiredNotice) {
    return <p className="text-sm text-gray-600">Время вышло. Подводим итоги…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Вопрос {index + 1} из {sorted.length}
        </span>
        {remainingMs != null && (
          <span
            className={
              remainingMs <= 60_000 ? 'font-semibold text-red-600' : 'font-medium text-gray-700'
            }
          >
            {formatTime(remainingMs)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sorted.map((q, i) => (
          <button
            key={q.questionId}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Вопрос ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i === index
                ? 'bg-blue-600'
                : isAnswered(answers[q.questionId])
                  ? 'bg-green-500'
                  : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {current && (
        <QuestionForm
          data={current.data}
          value={answers[current.questionId]}
          onChange={(value) => updateAnswer(current.questionId, value)}
        />
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          data-testid="quiz-back-button"
          onClick={() => goTo(Math.max(index - 1, 0))}
          disabled={index === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          Назад
        </button>

        <span data-testid="quiz-save-state" className="text-xs text-gray-400">
          {saveState === 'saving' ? 'Сохранение…' : saveState === 'saved' ? 'Сохранено' : ''}
        </span>

        {index < sorted.length - 1 ? (
          <button
            type="button"
            data-testid="quiz-next-button"
            onClick={() => goTo(index + 1)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Далее
          </button>
        ) : (
          <button
            type="button"
            data-testid="quiz-submit-button"
            onClick={handleSubmitClick}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Завершить тест
          </button>
        )}
      </div>

      {confirmOpen && (
        <ConfirmSubmitDialog
          unansweredNumbers={unansweredNumbers}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmSubmit}
        />
      )}
    </div>
  );
}

function ConfirmSubmitDialog({
  unansweredNumbers,
  onCancel,
  onConfirm,
}: {
  unansweredNumbers: number[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-lg">
        <h4 className="text-base font-semibold text-gray-900">Завершить тест?</h4>
        {unansweredNumbers.length > 0 ? (
          <p className="text-sm text-gray-600">
            Без ответа остались вопросы: {unansweredNumbers.join(', ')}. После завершения изменить
            ответы будет нельзя.
          </p>
        ) : (
          <p className="text-sm text-gray-600">После завершения изменить ответы будет нельзя.</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="quiz-confirm-submit-button"
            onClick={onConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Завершить
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionForm({
  data,
  value,
  onChange,
}: {
  data: SanitizedQuestionData;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (data.type === 'MULTICHOICE') {
    const current = (value as { choiceIds: string[] } | undefined)?.choiceIds ?? [];

    function toggle(choiceId: string) {
      if (data.type !== 'MULTICHOICE') return;
      if (data.single) {
        onChange({ choiceIds: [choiceId] });
        return;
      }
      const set = new Set(current);
      if (set.has(choiceId)) set.delete(choiceId);
      else set.add(choiceId);
      onChange({ choiceIds: Array.from(set) });
    }

    return (
      <div data-testid="question-container" className="space-y-3">
        <QuestionHtml
          testId="question-prompt"
          html={data.prompt}
          className="prose prose-sm max-w-none text-sm font-medium text-gray-900"
        />
        <div className="space-y-2">
          {data.choices.map((choice) => (
            <label
              key={choice.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <input
                type={data.single ? 'radio' : 'checkbox'}
                name="quiz-choice"
                data-testid={`choice-${choice.id}`}
                checked={current.includes(choice.id)}
                onChange={() => toggle(choice.id)}
              />
              <QuestionHtml html={choice.text} className="prose prose-sm max-w-none" />
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'TRUEFALSE') {
    const current = (value as { value: boolean } | undefined)?.value;
    return (
      <div data-testid="question-container" className="space-y-3">
        <QuestionHtml
          testId="question-prompt"
          html={data.prompt}
          className="prose prose-sm max-w-none text-sm font-medium text-gray-900"
        />
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="truefalse-true"
            onClick={() => onChange({ value: true })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
              current === true
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Верно
          </button>
          <button
            type="button"
            data-testid="truefalse-false"
            onClick={() => onChange({ value: false })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
              current === false
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Неверно
          </button>
        </div>
      </div>
    );
  }

  const current = (value as { text: string } | undefined)?.text ?? '';
  return (
    <div data-testid="question-container" className="space-y-3">
      <QuestionHtml
        testId="question-prompt"
        html={data.prompt}
        className="prose prose-sm max-w-none text-sm font-medium text-gray-900"
      />
      <input
        type="text"
        data-testid="shortanswer-input"
        value={current}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Введите ответ…"
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function QuizResult({
  result,
  canRetry,
  onRetry,
}: {
  result: SubmitResult;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const percent = scorePercent(result.score, result.maxScore);
  const passed = isPassed(result.score, result.maxScore, result.passingScore);
  const sorted = [...result.items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Результат теста</h3>
        <p data-testid="quiz-score" className="mt-1 text-2xl font-bold text-gray-900">
          {result.score} / {result.maxScore}{' '}
          <span className="text-base font-normal text-gray-500">({percent}%)</span>
        </p>
        {passed != null && (
          <p
            data-testid="quiz-passed"
            data-passed={passed}
            className={`mt-1 text-sm font-medium ${passed ? 'text-green-600' : 'text-red-600'}`}
          >
            {passed ? 'Тест пройден' : 'Тест не пройден'}
          </p>
        )}
        {result.status === 'EXPIRED' && (
          <p className="mt-1 text-sm text-amber-600">
            Время вышло — тест был завершён автоматически.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {sorted.map((item, i) => (
          <QuestionReview key={item.questionId} index={i + 1} item={item} />
        ))}
      </div>

      {canRetry && (
        <button
          type="button"
          data-testid="quiz-retry-button"
          onClick={onRetry}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Пройти ещё раз
        </button>
      )}
    </div>
  );
}

function QuestionReview({ index, item }: { index: number; item: GradedItem }) {
  return (
    <div
      data-testid={`question-review-${item.questionId}`}
      data-correct={item.isCorrect}
      className={`rounded-lg border p-4 ${
        item.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-1 text-sm font-medium text-gray-900">
          <span>{index}.</span>
          <QuestionHtml html={item.data.prompt} className="prose prose-sm max-w-none" />
        </div>
        <span
          data-testid="correctness-badge"
          className={`shrink-0 text-xs font-semibold ${
            item.isCorrect ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {item.isCorrect ? 'Верно' : 'Неверно'} · {item.earnedPoints}/{item.points}
        </span>
      </div>
      <div className="mt-2 text-sm text-gray-700">
        <AnswerReview data={item.data} answer={item.answer} />
      </div>
    </div>
  );
}

function AnswerReview({ data, answer }: { data: QuestionData; answer: unknown }) {
  if (data.type === 'MULTICHOICE') {
    const chosenIds = new Set((answer as { choiceIds?: string[] } | null)?.choiceIds ?? []);
    return (
      <ul className="space-y-1">
        {data.choices.map((choice) => {
          const chosen = chosenIds.has(choice.id);
          if (!chosen && !choice.correct) return null;
          return (
            <li
              key={choice.id}
              className={`flex items-baseline gap-1 ${
                chosen ? (choice.correct ? 'text-green-700' : 'text-red-700') : 'text-gray-500'
              }`}
            >
              <span>{chosen ? '●' : '○'}</span>
              <QuestionHtml html={choice.text} className="prose prose-sm max-w-none" />
              {choice.correct ? <span>(верный вариант)</span> : null}
              {chosen && choice.feedback ? <span>— {choice.feedback}</span> : null}
            </li>
          );
        })}
      </ul>
    );
  }

  if (data.type === 'TRUEFALSE') {
    const chosen = (answer as { value?: boolean } | null)?.value;
    return (
      <p>
        Ваш ответ: {chosen == null ? '—' : chosen ? 'Верно' : 'Неверно'}. Правильный ответ:{' '}
        {data.correctAnswer ? 'Верно' : 'Неверно'}.
      </p>
    );
  }

  const text = (answer as { text?: string } | null)?.text ?? '';
  return (
    <p>
      Ваш ответ: {text || '—'}. Принимаемые ответы: {data.acceptedAnswers.join(', ')}.
    </p>
  );
}

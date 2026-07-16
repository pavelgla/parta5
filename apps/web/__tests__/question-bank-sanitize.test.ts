import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from 'next-auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const questionCreateMock = vi.fn();

vi.mock('@parta5/db', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    SCHOOL_ADMIN: 'SCHOOL_ADMIN',
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT',
    PARENT: 'PARENT',
  },
  withTenant: (_schoolId: string, fn: (tx: unknown) => unknown) =>
    fn({
      question: { create: questionCreateMock },
    }),
}));

import { questionBankRouter } from '../server/routers/question-bank';
import { createCallerFactory, type Context } from '../server/trpc/init';

const createCaller = createCallerFactory(questionBankRouter);
const bankId = '123e4567-e89b-12d3-a456-426614174000';

function sessionFor(role: string): Session {
  return {
    user: { id: 'user-1', role, schoolId: 'school-1' },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as Session;
}

function caller() {
  return createCaller({ session: sessionFor('TEACHER') } as Context);
}

describe('questionBank.createQuestion sanitization', () => {
  beforeEach(() => {
    questionCreateMock.mockReset();
    questionCreateMock.mockImplementation(({ data }: { data: { data: unknown } }) => ({
      id: 'question-1',
      ...data,
    }));
  });

  it('strips <script> from prompt while keeping allowed markup', async () => {
    await caller().createQuestion({
      bankId,
      name: 'Q1',
      data: {
        type: 'MULTICHOICE',
        prompt: '<script>alert(1)</script><p>Вопрос</p>',
        single: true,
        shuffleChoices: false,
        choices: [
          { id: '0', text: 'A', correct: true },
          { id: '1', text: 'B', correct: false },
        ],
        defaultPoints: 1,
      },
    });

    const created = questionCreateMock.mock.calls[0][0].data.data as { prompt: string };
    expect(created.prompt).toBe('<p>Вопрос</p>');
  });

  it('sanitizes choices[].text for MULTICHOICE questions', async () => {
    await caller().createQuestion({
      bankId,
      name: 'Q2',
      data: {
        type: 'MULTICHOICE',
        prompt: '<p>Вопрос</p>',
        single: true,
        shuffleChoices: false,
        choices: [
          { id: '0', text: '<script>alert(1)</script>1', correct: true },
          { id: '1', text: '2', correct: false },
        ],
        defaultPoints: 1,
      },
    });

    const created = questionCreateMock.mock.calls[0][0].data.data as {
      choices: { text: string }[];
    };
    expect(created.choices[0].text).toBe('1');
    expect(created.choices[1].text).toBe('2');
  });

  it('leaves SHORTANSWER acceptedAnswers untouched', async () => {
    await caller().createQuestion({
      bankId,
      name: 'Q3',
      data: {
        type: 'SHORTANSWER',
        prompt: '<p>Вопрос</p>',
        acceptedAnswers: ['<script>x</script>answer'],
        caseSensitive: false,
        defaultPoints: 1,
      },
    });

    const created = questionCreateMock.mock.calls[0][0].data.data as {
      acceptedAnswers: string[];
    };
    expect(created.acceptedAnswers).toEqual(['<script>x</script>answer']);
  });
});

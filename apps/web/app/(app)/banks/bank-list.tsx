'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/react';

interface Bank {
  id: string;
  name: string;
  createdAt: Date;
  _count: { questions: number };
}

interface Props {
  banks: Bank[];
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function BankList({ banks }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const createBank = trpc.questionBank.create.useMutation({
    onSuccess: () => {
      setNewName('');
      setCreating(false);
      router.refresh();
    },
  });

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Банки</h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            + Новый банк
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createBank.mutate({ name: newName.trim() });
          }}
          className="flex gap-2 px-6 py-3 border-b border-gray-100"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            placeholder="Название банка"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={createBank.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Создать
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Отмена
          </button>
        </form>
      )}

      <ul className="divide-y divide-gray-100">
        {banks.map((bank) => (
          <BankRow key={bank.id} bank={bank} />
        ))}
        {banks.length === 0 && !creating && (
          <li className="px-6 py-8 text-center text-sm text-gray-400">
            Нет банков вопросов. Создайте первый!
          </li>
        )}
      </ul>
    </div>
  );
}

function BankRow({ bank }: { bank: Bank }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(bank.name);

  const renameBank = trpc.questionBank.rename.useMutation({
    onSuccess: () => {
      setRenaming(false);
      router.refresh();
    },
  });

  const deleteBank = trpc.questionBank.delete.useMutation({
    onError: (err: { message: string }) => alert(err.message),
    onSuccess: () => router.refresh(),
  });

  if (renaming) {
    return (
      <li className="flex items-center gap-2 px-6 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) renameBank.mutate({ id: bank.id, name: name.trim() });
          }}
          className="flex flex-1 gap-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={renameBank.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => {
              setRenaming(false);
              setName(bank.name);
            }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Отмена
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
      <Link href={`/banks/${bank.id}`} className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{bank.name}</div>
        <div className="text-xs text-gray-400">
          {bank._count.questions} вопрос(ов) · создан{' '}
          {dateFormatter.format(new Date(bank.createdAt))}
        </div>
      </Link>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="text-xs text-gray-400 hover:text-gray-700"
        >
          Переименовать
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Удалить банк «${bank.name}»?`)) {
              deleteBank.mutate({ id: bank.id });
            }
          }}
          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
          title="Удалить банк"
        >
          ×
        </button>
      </div>
    </li>
  );
}

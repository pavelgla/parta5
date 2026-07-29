'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { UserRole } from '@parta5/db';
import { trpc } from '@/lib/trpc/react';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '../role-labels';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function NewUserForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const createUser = trpc.user.create.useMutation({
    onSuccess: (user) => router.push(`/admin/users/${user.id}` as Route),
    onError: (err) => setServerError(err.message),
  });

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Укажите имя';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Некорректный email';
    if (password.length < 8) next.password = 'Пароль должен быть не короче 8 символов';
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    createUser.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      password,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700">ФИО</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Роль</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Пароль</label>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Не менее 8 символов"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/admin/users' as Route)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={createUser.isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {createUser.isPending ? 'Создание…' : 'Создать'}
        </button>
      </div>
    </form>
  );
}

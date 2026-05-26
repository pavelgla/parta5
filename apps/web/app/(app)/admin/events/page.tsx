import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverCaller } from '@/server/trpc/caller';

export default async function AdminEventsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const { role } = session.user;
  if (role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') {
    redirect('/'); // 403-equivalent
  }

  const caller = await serverCaller();
  const events = await caller.events.recent({ limit: 100 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Журнал событий</h1>
        {/* Simple refresh — server component, user can reload */}
        <a
          href="/admin/events"
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Обновить
        </a>
      </div>

      {events.length === 0 ? (
        <p className="text-gray-500">Нет событий.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Время', 'Актор', 'Глагол', 'Тип', 'Объект', 'Результат'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => (
                <tr key={String(event.id)} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600 max-w-[120px] truncate">
                    {event.actorId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        event.verb === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : event.verb === 'viewed'
                            ? 'bg-blue-100 text-blue-700'
                            : event.verb === 'enrolled'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {event.verb}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{event.objectType}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600 max-w-[120px] truncate">
                    {event.objectId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400 max-w-[200px] truncate">
                    {event.result ? JSON.stringify(event.result).slice(0, 80) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

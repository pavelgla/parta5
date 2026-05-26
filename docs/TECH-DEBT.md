# Tech debt — известные компромиссы и недоделки

Список вещей, которые сознательно не доделаны до конца ради скорости фазы.
Каждая запись помечена приоритетом и фазой, в которой её планируем закрыть.

---

## TD-001 — block.create без discriminated union валидации

**Где:** `apps/web/server/routers/block.ts` → procedure `create`.
**Что:** input.data валидируется как `z.record(z.string(), z.unknown())` вместо строгого `BlockDataSchema` discriminated union по `type` (как в `update`).
**Почему:** TS2589 «Type instantiation is excessively deep» из-за Prisma JsonValue в return type. Упростили чтобы шаг 5 Phase 1 не блокировался.
**Риск:** учитель через прямой вызов tRPC может создать блок с произвольным data, который сломает рендер. Через UI это не воспроизводится — UI всегда формирует корректный default.
**Фикс:** разделить input data validation от Prisma return type. Например, explicit return type `Promise<{id: string}>` вместо infer. Или явный `as const` в discriminated union.
**Приоритет:** P2 (не критично, но фиксить до Phase 2 — там Quiz роутеры с похожей структурой).
**Зафиксировано:** Phase 1 шаг 5 (2026-05-26).

---

## ~~TD-002 — pre-existing webpack errors в workspace пакетах~~ ✓ RESOLVED

**Где:** Next.js build, ошибки относятся к импортам из `@parta5/storage`, `@parta5/video`.
**Что (фактические ошибки):**

1. `Module not found: Can't resolve './adapter.js'` и `'./s3.js'` — пакеты использовали `.js`-расширения в TypeScript-импортах (Node16/ESM стиль), которые webpack не резолвит.
2. `Module not found: Can't resolve './embed/index.js'` — аналогично в `@parta5/video`.
3. `UnhandledSchemeError: Reading from "node:fs/promises" is not handled` — `@parta5/storage/src/s3.ts` импортировал `node:fs`, а `lib/file-url.ts` тянул его в клиентский бандл через `'use client'` компонент.
   **Почему:** ESM-стиль в TS-исходниках несовместим с webpack-резолюцией Next.js. Плюс server-only модуль попадал в клиентский граф импортов.
   **Фикс применён (2026-05-26):**

- `apps/web/next.config.ts`: добавлен `transpilePackages: ['@parta5/db', '@parta5/storage', '@parta5/video']`.
- Убраны `.js` расширения из импортов в `packages/storage/src/{index,s3}.ts` и `packages/video/src/{index,embed/index,self-hosted}.ts`.
- `apps/web/lib/file-url.ts`: переписан без импорта `@parta5/storage` — теперь использует `NEXT_PUBLIC_S3_PUBLIC_URL` / `S3_PUBLIC_URL` напрямую, чтобы избежать затягивания `node:fs` в клиентский бандл.
  **Результат:** `pnpm --filter web build` завершается успешно. Только ESLint warnings (не ошибки).
  **Зафиксировано:** Phase 1 шаг 5 (2026-05-26). **Закрыто:** Phase 1 шаг 5 (2026-05-26).

---

## TD-003 — YouTube IFrame API не интегрирован для progress tracking

**Где:** `apps/web/components/embed-player.tsx`.
**Что:** Для YouTube embed-видео нет автоматического определения момента «досмотрел» через YouTube IFrame Player API (`onStateChange` → state=ENDED). Сейчас стоит кнопка «Я посмотрел», ученик должен нажать вручную.
**Почему:** В шаге 7 Phase 1 решили не растягивать шаг — YouTube требует загрузки `https://www.youtube.com/iframe_api` и обёртки над `window.YT.Player`. Остальные провайдеры (RuTube/VK/Vimeo/Kinescope/Boomstream/Дзен) имеют разные postMessage API, унификация — отдельная задача.
**Риск:** UX чуть хуже для YouTube-блоков — ученик может забыть нажать «Я посмотрел». LessonCompletion не сработает автоматически.
**Фикс:** добавить опциональный YouTube IFrame API: динамически загружать скрипт, создавать Player с events, при state === YT.PlayerState.ENDED вызывать onCompleted. Возможно сделать общий interface `EmbedPlayerProvider` с capability `hasProgressEvents`.
**Приоритет:** P3 (UX-улучшение, не блокер).
**Зафиксировано:** Phase 1 шаг 7 (2026-05-26).

---

## Шаблон для новых записей

```
## TD-NNN — короткое название

**Где:** файл или модуль.
**Что:** что именно не доделано.
**Почему:** причина компромисса.
**Риск:** что может сломаться или ухудшиться.
**Фикс:** как закрыть.
**Приоритет:** P0 (немедленно) / P1 (в текущей фазе) / P2 (в следующей фазе) / P3 (когда-нибудь).
**Зафиксировано:** Phase N шаг M (YYYY-MM-DD).
```

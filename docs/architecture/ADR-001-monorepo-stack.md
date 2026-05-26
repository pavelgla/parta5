# ADR-001: Монорепо на pnpm + Turborepo, стек Next.js 15 + tRPC + Prisma

**Статус:** принято  
**Дата:** 2026-05-26

## Контекст

Нужен стек для open-source LMS, который:

- Поддерживает full-stack TypeScript от схемы БД до UI
- Позволяет хостить одним докер-контейнером (self-host школы)
- Прост в разворачивании и поддержке небольшой командой

## Варианты

| Вариант                           | Плюсы                              | Минусы                                             |
| --------------------------------- | ---------------------------------- | -------------------------------------------------- |
| Next.js + tRPC + Prisma (выбрано) | Единый TS стек, RSC, type-safe API | Привязка к Node.js                                 |
| Remix + Drizzle                   | Сильная модель data loading        | Меньше экосистема, Drizzle менее зрелый            |
| SvelteKit + PocketBase            | Простота деплоя                    | Не TS-first, PocketBase ограничен для сложных схем |

## Решение

Монорепо: pnpm workspaces + Turborepo.  
Пакеты: `apps/web` (Next.js 15 App Router), `packages/db` (Prisma + seed).  
API: tRPC v11 для внутреннего использования; REST/OpenAPI — только для публичных эндпоинтов (LTI, webhooks).  
ORM: Prisma с PostgreSQL 16+.

## Последствия

- tRPC процедуры типизированы end-to-end: изменение схемы сразу видно в UI
- Prisma migrations обязательны (нет ручного SQL в продакшене)
- `packages/db` переиспользуется в `apps/worker` (BullMQ) без дублирования

## Откат

При необходимости REST API можно добавить через `fetchRequestHandler` без изменений tRPC логики.

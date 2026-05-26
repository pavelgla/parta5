---
type: project
status: active
last_active: 2026-05-26
stack: [Next.js 15, tRPC v11, Prisma, PostgreSQL 16, Auth.js v5, Tailwind v4, pnpm, Turborepo]
goal: Open-source LMS для российских школ (MPL 2.0) — альтернатива Moodle
domain: parta5.ru
repo: https://github.com/pavelgla/parta5
---

## TL;DR

**Парта5** — open-core LMS для школ 5–11 классов и УДО. Бесплатное ядро под MPL 2.0, платные SaaS-облако и модули сверху. Текущая фаза: **Phase 1** (Phase 0 завершена 2026-05-26).

## Стек

| Слой | Технология |
|------|-----------|
| App | Next.js 15 App Router + React Server Components |
| API | tRPC v11 (внутренний) |
| БД | PostgreSQL 16 + Prisma ORM |
| Аутентификация | Auth.js v5 (Credentials + JWT) |
| Мульти-тенантность | PostgreSQL RLS + `withTenant()` хелпер |
| Стили | Tailwind v4 |
| Монорепо | pnpm workspaces + Turborepo |

## Структура репо

```
apps/web/          — Next.js приложение
packages/db/       — Prisma schema, миграции, withTenant()
```

## Текущие задачи (Phase 1)

- [ ] Quiz engine (GIFT/QTI import, типы вопросов)
- [ ] H5P интеграция (`@lumieducation/h5p-server`)
- [ ] SCORM 1.2 импорт
- [ ] Role-based access control (TEACHER vs STUDENT permissions)
- [ ] Email-уведомления (SMTP / Unisender Go)

## Открытые вопросы

- Нужен ли отдельный `apps/worker` для BullMQ уже в Phase 1 или позже?
- Хранить медиафайлы в локальной файловой системе (self-host MVP) или сразу S3-совместимое?
- ЕСИА OIDC — в какой фазе начинать?

## Последние 5 решений

1. **Auth.js middleware split** — `auth.config.ts` (Edge-safe, без Prisma) для middleware; `auth.ts` расширяет его с Credentials провайдером
2. **RLS + FORCE ROW LEVEL SECURITY** — блокирует даже table owner; приложение использует `parta5_app` non-superuser роль в prod
3. **tRPC v11** — `createCallerFactory` из `t` (не из пакета), RSC → tRPC через `serverCaller()`
4. **typedRoutes** — требует `next build` для генерации `.next/types/link.d.ts`; standalone `tsc --noEmit` не работает без него
5. **Prisma checksum drift** — prettier форматирует SQL миграции через lint-staged; исправляется обновлением checksum в `_prisma_migrations`

## Полезные команды

```bash
# Dev
pnpm dev                                    # запуск всего монорепо

# БД
pnpm --filter @parta5/db exec prisma studio          # GUI для БД
pnpm --filter @parta5/db exec prisma migrate dev     # новая миграция
pnpm --filter @parta5/db exec prisma migrate deploy  # применить в prod

# Проверки
pnpm --filter web exec tsc --noEmit         # typecheck
pnpm --filter web exec next build           # full build + lint

# Docker (self-host)
docker compose up -d                        # поднять стек
docker compose run --rm migrate             # применить миграции
```

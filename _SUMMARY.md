---
type: project
status: active
last_active: 2026-05-26
phase: 1
phase_status: not_started
stack: [Next.js 15, tRPC v11, Prisma, PostgreSQL 16, Auth.js v5, Tailwind v4, pnpm, Turborepo]
goal: Open-source LMS для школ 5–11 классов и УДО РФ (MPL 2.0) — альтернатива Moodle
domain: parta5.ru
repo: https://github.com/pavelgla/parta5
---

## TL;DR

**Парта5** — open-core LMS для школ 5–11 классов и УДО. Бесплатное ядро под MPL 2.0, платные SaaS-облако и модули сверху. Self-host философия «как Moodle, но современно»: один `docker compose up` и работает.

**Phase 0 закрыт** (2026-05-26, tag `v0.1.0-phase0`). Дальше — Phase 1.

## Стек

| Слой | Технология |
|------|-----------|
| App | Next.js 15 App Router + React Server Components |
| API | tRPC v11 (внутренний) |
| БД | PostgreSQL 16 + Prisma ORM |
| Аутентификация | Auth.js v5 (Credentials + JWT, Edge-safe split: `auth.config.ts` / `auth.ts`) |
| Мульти-тенантность | PostgreSQL RLS + `withTenant()` хелпер |
| Стили | Tailwind v4 |
| Монорепо | pnpm workspaces + Turborepo |
| Видео (Phase 1) | Self-hosted FFmpeg → HLS → HLS.js + универсальный embed |
| Хранилище (Phase 1) | S3-совместимое (MinIO для self-host) |
| Очереди (Phase 1) | Redis + BullMQ (`apps/worker`) |

## Структура репо

```
apps/
  web/             — Next.js приложение
  worker/          — BullMQ воркер (с Phase 1: видео-транскодинг, далее AI)
packages/
  db/              — Prisma schema, миграции, withTenant()
  storage/         — S3 adapter (Phase 1)
  video/           — VideoAdapter (self-hosted HLS + embed) (Phase 1)
  quiz/            — Question schemas + auto-grade engine (Phase 2)
docs/
  architecture/    — ADR-001 (стек), ADR-002 (RLS multi-tenancy)
                     далее: ADR-003 (видео-стратегия, Phase 1), 004-006 (Phase 2)
```

## Phase 0 — что сделано (14 коммитов, tag v0.1.0-phase0)

- Монорепо: pnpm + Turborepo + TypeScript strict + MPL 2.0
- Next.js 15 + Tailwind v4 + базовая навигация
- Prisma schema: School / User / Course / Module / Lesson / ContentBlock / Enrollment / LessonCompletion
- PostgreSQL RLS с `withTenant()` обёрткой и FORCE ROW LEVEL SECURITY
- Auth.js v5 с credentials provider + Edge-safe middleware (`auth.config.ts` без Prisma)
- tRPC v11: 5 роутеров (course/module/lesson/block/enrollment) + React Query
- Course editor UI: `/courses`, `/courses/new`, `/courses/[id]/edit`
- Student learn view: `/learn/[courseId]` с прогрессом по урокам
- Docker Compose: web + db + migrate (Next.js standalone)
- GitHub Actions CI: lint + typecheck + build
- ADR-001 (стек), ADR-002 (RLS multi-tenancy)

## Phase 1 — что предстоит (4–6 недель, см. `phase-1.md`)

1. Расширить ContentBlock до 12 типов (TEXT/HEADING/LIST/IMAGE/VIDEO/VIDEO_EMBED/FILE/CALLOUT/CODE/QUOTE/DIVIDER/EMBED_IFRAME)
2. S3-хранилище: MinIO в docker-compose + `packages/storage`
3. Файловые загрузки через presigned URLs + модель `FileAsset`
4. `apps/worker` + FFmpeg + HLS-транскодинг + `packages/video` (SelfHostedHLS + ExternalEmbed)
5. Блочный редактор Notion-style: TipTap + dnd-kit
6. Метаданные курса: обложка, предмет, класс, rich-описание
7. Прогресс по блокам (`BlockView` + IntersectionObserver + HLS.js events)
8. `LearningEvent` xAPI-like append-only журнал
9. Publishing flow: DRAFT → PUBLISHED → ARCHIVED + превью
10. Демо-курс RunStart + Playwright e2e

## Дальнейшие фазы

- **Phase 2** (4–6 нед) — тесты и задания, см. `phase-2.md`. Уже написана.
- Phase 3 — импорт `.mbz` из Moodle.
- Phase 4 — аналитика, родители, комментарии.
- Phase 5 — LTI 1.3, SCORM, H5P, AI-фичи.
- Phase 6 — ЕСИА, ФГИС «Моя школа», Дневник.ру.
- Phase 7 — биллинг, white-label, реестр ОВП.

## Ключевые архитектурные решения

1. **Edge-safe Auth.js split** — `auth.config.ts` (без Prisma) для middleware; `auth.ts` расширяет с Credentials. См. правило в CLAUDE.md.
2. **RLS + FORCE ROW LEVEL SECURITY** — блокирует даже table owner; приложение использует non-superuser роль в prod.
3. **tRPC v11** — `createCallerFactory` из `t`, RSC → tRPC через `serverCaller()`.
4. **typedRoutes** — требует `next build` для генерации `.next/types/link.d.ts`.
5. **Prisma checksum drift** — prettier форматирует SQL миграции через lint-staged → checksum обновляется в `_prisma_migrations`.
6. **Видео self-hosted** (Phase 1, ADR-003 в работе) — никаких обязательных внешних SaaS, FFmpeg на школьном сервере. Опциональные SaaS-адаптеры (Kinescope, Boomstream) — отдельными модулями в Phase 4+.

## Открытые вопросы

- GitFlic-зеркало репозитория ещё не создано (обязательно для реестра ОВП).
- Реальный `.mbz` из Moodle для тестирования импортёра (нужно в Phase 3).
- Школа-пилот в Карелии — поиск через RunStart-связи.
- Регистрация ИП и подача товарного знака «Парта5» в Роспатент.

## Полезные команды

```bash
# Dev
pnpm dev                                    # запуск всего монорепо

# БД
pnpm --filter @parta5/db exec prisma studio          # GUI для БД
pnpm --filter @parta5/db exec prisma migrate dev     # новая миграция
pnpm --filter @parta5/db exec prisma migrate deploy  # применить в prod
pnpm --filter @parta5/db exec prisma db seed         # тестовые данные

# Проверки
pnpm --filter web exec tsc --noEmit         # typecheck
pnpm --filter web exec next build           # full build + lint
pnpm test                                    # vitest

# Docker (self-host)
docker compose up -d                        # поднять стек
docker compose run --rm migrate             # применить миграции
```

## Дисциплина

- Перед каждым шагом фаз — `git status` чистый.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Pre-commit hook (husky + lint-staged) — prettier на staged файлы.
- Не импортируй Prisma в `middleware.ts` / `auth.config.ts` (Edge runtime, см. CLAUDE.md).
- Не пишь `any`, не используй `@ts-ignore` без комментария.
- Не коммить `.env`, секреты — только через Bitwarden.

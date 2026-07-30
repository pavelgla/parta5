---
type: project
status: active
last_active: 2026-07-30
phase: D (пилот ПСР, суперплан 2026-07)
phase_status: deployed (контент залит, брендирование и витрина в бою)
next: демо пилота Александру Белому (ПСР); дальше этап E — задания и уведомления
stack: [Next.js 15, tRPC v11, Prisma, PostgreSQL 16, Auth.js v5, Tailwind v4, pnpm, Turborepo]
goal: Open-source LMS для школ 5–11 классов, УДО и ДПО РФ (MPL 2.0) — альтернатива Moodle
domain: parta5.ru
repo: https://github.com/pavelgla/parta5
---

## TL;DR

**Парта5** — open-core LMS для школ 5–11 классов, УДО и ДПО. Бесплатное ядро под MPL 2.0, платные SaaS-облако и модули сверху. Self-host философия «как Moodle, но современно»: один `docker compose up` и работает.

**Phase 0 и Phase 1 закрыты** (2026-05-26, tags `v0.1.0-phase0` / `v0.2.0-phase1`).

**2026-07-15 — ревью и новый суперплан.** Senior+product ревью: `docs/reviews/2026-07-senior-product-review.md`. Роадмап пересобран под пилот с реальным контентом **Профспецресурса** (Moodle 5.0.6 на sel1, проект `~/Obsidian/1-projects/psr`: 106 курсов, 62 940 multichoice-вопросов, 773 PDF): `docs/SUPERPLAN.md`. Этапы: **A** hardening (RBAC! RLS-дыры) → **B** квиз-MVP (multichoice/truefalse/shortanswer) → **C** импортер .mbz → **D** пользователи + пилот PSR. Исполнение — PROMPTS.md конвейером Sonnet.

## Стек

| Слой                | Технология                                                                    |
| ------------------- | ----------------------------------------------------------------------------- |
| App                 | Next.js 15 App Router + React Server Components                               |
| API                 | tRPC v11 (внутренний)                                                         |
| БД                  | PostgreSQL 16 + Prisma ORM                                                    |
| Аутентификация      | Auth.js v5 (Credentials + JWT, Edge-safe split: `auth.config.ts` / `auth.ts`) |
| Мульти-тенантность  | PostgreSQL RLS + `withTenant()` хелпер                                        |
| Стили               | Tailwind v4                                                                   |
| Монорепо            | pnpm workspaces + Turborepo                                                   |
| Видео (Phase 1)     | Self-hosted FFmpeg → HLS → HLS.js + универсальный embed                       |
| Хранилище (Phase 1) | S3-совместимое (MinIO для self-host)                                          |
| Очереди (Phase 1)   | Redis + BullMQ (`apps/worker`)                                                |

## Структура репо

```
apps/
  web/             — Next.js приложение
  worker/          — BullMQ воркер (с Phase 1: видео-транскодинг, далее AI)
packages/
  db/              — Prisma schema, миграции, withTenant()
  storage/         — S3 adapter (Phase 1)
  video/           — VideoAdapter (self-hosted HLS + embed) (Phase 1)
  quiz/            — question schemas + auto-grade engine (Этап B)
  importer/        — парсер .mbz / Moodle XML (Этап C)
docs/
  architecture/    — ADR-001 (стек), ADR-002 (RLS), ADR-003 (видео)
  reviews/         — 2026-07 senior+product ревью
  SUPERPLAN.md     — актуальный роадмап (этапы A–H)
  STAGE-D-SPEC.md  — спека этапа D (пользователи, пилот)
  APPEARANCE-SPEC.md — спека внешнего вида (брендирование, витрина)
```

## Phase 0 ✅ — закрыт (14 коммитов, tag `v0.1.0-phase0`)

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

## Phase 1 ✅ — закрыт (tag `v0.2.0-phase1`, 2026-05-26)

- 12 типов блоков (HEADING, TEXT, LIST, IMAGE, VIDEO, VIDEO_EMBED, FILE, CALLOUT, CODE, QUOTE, DIVIDER, EMBED_IFRAME)
- S3-хранилище: MinIO + `packages/storage`, загрузки через presigned URLs
- `apps/worker` + FFmpeg + HLS-транскодинг + `packages/video`
- Блочный редактор Notion-style: TipTap + dnd-kit
- Прогресс по блокам через IntersectionObserver + LearningEvent xAPI-like журнал
- Publishing flow: DRAFT → PUBLISHED → ARCHIVED + превью
- Демо-курс «Введение в бег» (RunStart) + Playwright e2e

## Текущее состояние — этапы A–D закрыты, пилот в бою

> Роадмап 2026-07 заменил прежнюю нумерацию фаз 2–7 на этапы A–H (`docs/SUPERPLAN.md`).
> Цель этапов A–D — пилот с реальным контентом Профспецресурса — достигнута.

- [x] **Этап A** — hardening: RBAC (teacher/adminProcedure + ownership), RLS на BlockView/FileAsset/VideoAsset/LearningEvent, непривилегированная DB-роль, фикс compose, enrollment-политика, воркер retry/timeout, негативные authz-тесты ✅ 2026-07-16
- [x] **Этап B** — квиз-MVP: `@parta5/quiz` (multichoice/truefalse/shortanswer), Quiz/QuizAttempt, UI прохождения, журнал + CSV ✅ 2026-07-16
- [x] **Этап C** — импортер `.mbz`: `packages/importer`, маппинг quiz/resource/page/url, CLI dry-run, картинки вопросов (`@@PLUGINFILE@@`) ✅ 2026-07-16
- [x] **Этап D** — админ-UI пользователей и групп, CSV-ростер (UTF-8/Windows-1251), состав курса, деплой на sel1 → https://psr.parta5.ru, сквозной сценарий вживую (билет ПДД с картинками → оценка в журнале) ✅ 2026-07-29
- [x] **Батч-миграция ПСР** — 106 курсов / 2954 теста / 62 942 вопроса, 0 ошибок; 104 курса опубликованы, 101 с обложками из бэкапов ✅ 2026-07-29
- [x] **Внешний вид** — брендирование школы (поля School + `/admin/settings` + шапка/футер/вход), публичная витрина без логина (лендинг, `/catalog` с поиском и пагинацией, страница курса), пустые разделы Moodle скрыты от слушателя. Спека — `docs/APPEARANCE-SPEC.md` ✅ 2026-07-30
- [ ] **Демо пилота Александру Белому** (ПСР) — инстанс готов, контент залит, брендирование на месте
- [ ] parta5: снять с публикации тестовые курсы ПСР, видимые гостю в каталоге ⏳ 2026-07-31
- [ ] parta5: проверить загрузку логотипа через `/admin/settings` под админом ПСР (на проде залит в обход UI) 📅 2026-08-03

## Дальнейшие этапы

- **E** — Assignment/рубрики, комментарии, уведомления, полный Gradebook.
- **F** — аналитика, SCORM, H5P, LTI 1.3, AI-фичи.
- **G** — ЕСИА, ФГИС «Моя школа», Дневник.ру, родительский кабинет.
- **H** — биллинг, white-label, GitFlic, реестр ОВП.

## Ключевые архитектурные решения

0. **Брендирование — настройка школы, не тема сборки.** Поля в `School` (название системы, юр. наименование, домен витрины, цвет, логотип, контакты, быстрые ссылки) + `/admin/settings`. Школа на публичных страницах резолвится по хосту запроса (`School.domain`), затем как единственная школа инстанса. Цвет — CSS-переменные `--brand` / `--brand-foreground`. В коде нет условий «если школа ПСР».
1. **Edge-safe Auth.js split** — `auth.config.ts` (без Prisma) для middleware; `auth.ts` расширяет с Credentials. См. правило в CLAUDE.md.
2. **RLS + FORCE ROW LEVEL SECURITY** — блокирует даже table owner; приложение использует non-superuser роль в prod.
3. **tRPC v11** — `createCallerFactory` из `t`, RSC → tRPC через `serverCaller()`.
4. **typedRoutes** — требует `next build` для генерации `.next/types/link.d.ts`.
5. **Prisma checksum drift** — prettier форматирует SQL миграции через lint-staged → checksum обновляется в `_prisma_migrations`.
6. **Видео self-hosted** (Phase 1, ADR-003 в работе) — никаких обязательных внешних SaaS, FFmpeg на школьном сервере. Опциональные SaaS-адаптеры (Kinescope, Boomstream) — отдельными модулями в Phase 4+.

## Открытые вопросы

- GitFlic-зеркало репозитория ещё не создано (обязательно для реестра ОВП).
- ~~Реальный `.mbz` для тестирования импортёра~~ — **решено**: Профспецресурс (sel1, `/opt/psr`, полный доступ), экспорт через Moodle CLI/moosh. Согласовать пилот с Александром Белым.
- Школа-пилот в Карелии — поиск через RunStart-связи (параллельно с ДПО-пилотом PSR).
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

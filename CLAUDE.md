# Инструкции для Claude Code — проект Парта5

> Этот файл читается Claude Code (и Cowork-сессиями) автоматически при работе с репозиторием.
> Цель — дать ИИ-ассистенту полный контекст без необходимости каждый раз пересказывать его руками.

---

## Контекст проекта

**Парта5** (домен parta5.ru) — open-source LMS для средних общеобразовательных школ и учреждений дополнительного образования РФ. Альтернатива Moodle с фокусом на простоту self-host, AI-нативность и российские реалии (152-ФЗ, реестр отечественного ПО, интеграции с гос-системами).

- **Аудитория:** школы 5–11 классов, УДО, преподаватели, ученики, родители.
- **Конкуренты:** Moodle (open-source, доминирует в школах), Skillspace / iSpring Learn / Teachbase / МТС Линк Курсы (закрытые корпоративные SaaS).
- **Бизнес-модель:** open-core — бесплатное ядро под MPL 2.0, платные SaaS-облако и модули сверху.
- **Текущая фаза:** пилот у заказчика. Этапы A–D суперплана закрыты, инстанс ПрофСпецРесурса
  работает на https://psr.parta5.ru (106 курсов из их Moodle, брендирование школы, публичная
  витрина). Дальше — этапы E–H (`docs/SUPERPLAN.md`).

Главный стратегический документ — `01-analysis-and-plan.md`. Перед существенными изменениями архитектуры — прочитать его и обновить.

---

## Архитектура и стек

| Слой                | Технология                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend + Backend  | Next.js 15 (App Router) + React Server Components                                                                                                                 |
| API                 | tRPC (внутренний), OpenAPI/REST обёртка (для внешних интеграций)                                                                                                  |
| БД                  | PostgreSQL 16+                                                                                                                                                    |
| ORM                 | Prisma                                                                                                                                                            |
| Кеш + очереди       | Redis + BullMQ                                                                                                                                                    |
| Объектное хранилище | S3-совместимое (Yandex Object Storage / VK Cloud / MinIO)                                                                                                         |
| Видео               | Self-hosted: FFmpeg-воркер → HLS в S3 → HLS.js плеер. Плюс универсальный embed (YouTube/RuTube/VK/Kinescope/Vimeo/Boomstream). Никаких обязательных внешних SaaS. |
| Аутентификация      | Auth.js (NextAuth) + ЕСИА OIDC для гос-сегмента                                                                                                                   |
| AI                  | OpenAI API + Anthropic API через единый адаптер, pgvector для RAG                                                                                                 |
| Уведомления         | SMTP (Unisender Go / Mailopost) + Telegram Bot API + Web Push (PWA)                                                                                               |
| Поиск               | PostgreSQL Full-Text Search → Meilisearch при росте                                                                                                               |
| Аналитика событий   | таблица `learning_event` (xAPI-like) в Postgres → ClickHouse при росте                                                                                            |
| Контейнеризация     | Docker + docker-compose для self-host                                                                                                                             |

### Мульти-тенантность

**Каждая запись в БД принадлежит школе.** Это означает:

- В каждой таблице (кроме `User` в глобальном scope) — поле `school_id`.
- Включён PostgreSQL Row Level Security; политика проверяет `current_setting('app.current_school_id')`.
- В Prisma — middleware, который автоматически добавляет `school_id` в каждый запрос.
- S3-ключи префиксуются `schools/<school_id>/...`.

Мульти-тенантность включается **с первого коммита**, не «потом».

### Стандарты, поддерживаемые ядром

- **LTI 1.3 Advantage** (как платформа): Core Launch, AGS, NRPS, Deep Linking 2.0. OIDC + RS256 JWT + OAuth 2.0.
- **SCORM 1.2** (импорт пакетов).
- **xAPI / cmi5** (нативный формат learning-событий).
- **H5P** (через `@lumieducation/h5p-server`, MIT-лицензия).
- **Moodle XML / GIFT / IMS QTI 2.0** (импорт банков вопросов).

---

## Структура репозитория (целевая)

```
parta5/
├── apps/
│   ├── web/              # Next.js приложение
│   └── worker/           # BullMQ воркеры (импорт, AI, видео-обработка)
├── packages/
│   ├── db/               # Prisma schema, миграции, сидинг
│   ├── ui/               # Общие React-компоненты
│   ├── core/             # Доменная логика без зависимостей от Next.js
│   ├── importer/         # Парсер Moodle .mbz и Moodle XML / GIFT
│   ├── lti/              # LTI 1.3 Advantage реализация
│   └── ai/               # Адаптер OpenAI/Anthropic + RAG
├── docs/                 # Документация
│   ├── architecture/     # ADR (Architecture Decision Records)
│   ├── api/              # OpenAPI спецификации внешнего API
│   └── deployment/       # Self-host гайды
├── docker-compose.yml    # Self-host stack
├── README.md
├── CLAUDE.md             # этот файл
└── 01-analysis-and-plan.md
```

Используется монорепо на **pnpm workspaces** + **Turborepo**.

---

## Соглашения о коде

- **TypeScript strict mode** во всех пакетах. Никакого `any`, никаких `@ts-ignore` без обоснования в комментарии.
- **Имена файлов:** kebab-case (`course-card.tsx`, `mbz-importer.ts`).
- **React-компоненты:** PascalCase (`CourseCard`, `LessonEditor`).
- **API:** tRPC procedures для внутреннего использования. REST/OpenAPI — только для публичных эндпоинтов (LTI, webhook'и, мобильное приложение).
- **Тесты:** Vitest для unit, Playwright для e2e. Цель — 70% покрытия core-логики, 100% критичных путей (платежи, оценки, аутентификация).
- **Линтер:** ESLint + Prettier. Husky + lint-staged на pre-commit.
- **Коммиты:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Скоуп в скобках, например `feat(quiz): add cloze question type`.
- **Миграции БД:** только через `prisma migrate`. Никаких ручных SQL на проде.
- **Языки:**
  - UI и пользовательские строки — на русском (основной), английском (резерв через i18n).
  - Идентификаторы, имена переменных, комментарии в коде — на английском.
  - Документация — на русском (для команды и пользователей).

### Edge runtime и Auth.js — критичный паттерн

Next.js `middleware.ts` запускается в **Edge Runtime** (Cloudflare Workers-подобный sandbox), где НЕТ доступа к Node.js API: `fs`, `crypto`, native bindings, и — **главное — Prisma не работает**. Если попытаться импортировать `@parta5/db` в middleware, билд сломается с непонятной ошибкой про `node:async_hooks` или `bindings`.

**Правильный паттерн Auth.js v5 в этом проекте** (зафиксирован в Phase 0):

- `apps/web/auth.config.ts` — **edge-safe** конфиг: providers, callbacks, jwt/session — БЕЗ Prisma. Это импортируется в middleware.
- `apps/web/auth.ts` — **node-side**: расширяет `auth.config.ts`, добавляет PrismaAdapter, Credentials provider с bcrypt-проверкой. Это импортируется в server actions, route handlers, server components.
- `apps/web/middleware.ts` — импортирует ТОЛЬКО из `auth.config.ts` через `NextAuth(authConfig).auth`.

**НЕ** ломай этот паттерн:

- НЕ импортируй `@parta5/db`, `bcryptjs`, `node:*`, `fs` в `middleware.ts` или `auth.config.ts`.
- НЕ объединяй `auth.config.ts` и `auth.ts` в один файл.
- НЕ добавляй БД-логику в `jwt`/`session` callbacks в `auth.config.ts` — выноси её в server actions, которые перед `signIn` сами читают/пишут в БД.

То же правило применимо к любому коду, который ты захочешь использовать в middleware (например, rate limiting через Redis): он должен быть Edge-совместимым (используй `@upstash/redis` HTTP client, не `ioredis`).

### Запреты

- **НЕ** использовать AGPL для зависимостей в ядре — это вирус, который заставит открыть весь код. Только MIT / Apache 2.0 / MPL / BSD / ISC.
- **НЕ** копировать UX Moodle. Это главная боль конкурентов.
- **НЕ** делать микросервисы преждевременно. Монолит работает до ~10 000 активных пользователей.
- **НЕ** хранить персональные данные у иностранных провайдеров (152-ФЗ).
- **НЕ** использовать платные шрифты или иконки в open-source ядре.
- **НЕ** писать `console.log` в продакшен-коде. Использовать `pino` или встроенный логгер.
- **НЕ** хардкодить токены, ключи, пароли. Только через `process.env` и `.env.example` с описаниями.
- **НЕ** импортировать Prisma и Node-only зависимости в `middleware.ts` / `auth.config.ts` (см. секцию «Edge runtime» выше).

---

## Соответствие нормативке

- **152-ФЗ:** персональные данные шифруются at rest, не пишутся в логи в открытом виде, поддерживается экспорт и удаление по запросу субъекта.
- **Реестр отечественного ПО:** исходный код хостится на GitFlic.ru (зеркало GitHub разрешено). Все права у российского ИП/ЮЛ. Документация на русском.
- **Минцифры (для ЕСИА):** регистрация системы как ИС класса К2/К3, подаётся параллельно с разработкой.
- **WCAG 2.1 AA** — минимальный уровень доступности.

---

## Производительность

- First Contentful Paint < 1.5s на 3G.
- Страница урока должна корректно отображаться **без JavaScript** (для слабых школьных сетей и устаревших устройств).
- Изображения через Next.js `<Image>` с автоматическим AVIF/WebP.
- Видео — self-hosted через FFmpeg-воркер с транскодингом в HLS (360p/720p/1080p, master.m3u8 + сегменты в S3). Плеер — HLS.js. Никаких обязательных внешних SaaS — школа ставит `docker compose up` и работает автономно. Для тех, кто не хочет хранить — универсальный embed-блок (YouTube/RuTube/VK/Kinescope/Vimeo/Boomstream).
- Адаптеры для коммерческих SaaS-видеосервисов — опциональные модули, НЕ в ядре.

---

## Ключевые документы (читать до начала работы)

- `01-analysis-and-plan.md` — стратегический план, MVP, миграция, дорожная карта.
- `README.md` — публичное описание.
- `00-parta5.md` — Obsidian-индексная нота, актуальный статус и чек-листы.
- `docs/architecture/*.md` — ADR (Architecture Decision Records), один файл на одно решение.

## Что делать в неоднозначных ситуациях

1. Сначала проверить `01-analysis-and-plan.md` и `docs/architecture/`.
2. Если решение влияет на архитектуру — создать ADR в `docs/architecture/`, пометить статус `proposed`, описать варианты.
3. Если решение тактическое — реализовать, отметить в коде комментарием с обоснованием.
4. Если нет уверенности — спросить Paul, **не выдумывать**.

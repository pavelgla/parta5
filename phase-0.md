# Phase 0 — план выполнения для Claude Code

> Этот файл — исполнительный сценарий для Claude Code. Прочитай его целиком, прочитай `CLAUDE.md`, потом выполняй шаги строго по порядку.

---

## Правила выполнения (читай ОБЯЗАТЕЛЬНО)

1. **Перед стартом любого шага** убедись, что рабочее дерево чистое: `git status`. Если есть незакоммиченные изменения от предыдущего шага — закоммить или откатить.
2. **Выполни шаг** ровно как описано в его секции. Не отступай в сторону, не добавляй того, что не просят.
3. **Запусти проверки** из раздела «Проверка» шага. Если хотя бы одна не прошла — исправь, не двигайся дальше.
4. **Закоммить** одним коммитом с сообщением из секции «Коммит» шага (Conventional Commits).
5. **Обнови чек-лист** в этом файле: замени `- [ ]` на `- [x]` для завершённого шага. Это тоже коммит: `chore: mark step N complete`.
6. **Переходи к следующему шагу.**

Если шаг **не получается** (внешняя зависимость, неясное требование) — НЕ выдумывай. Остановись, опиши проблему в комментарии и спроси Paul.

---

## Секреты через Bitwarden

У Paul настроен Bitwarden CLI и MCP-сервер `bitwarden`. Перед использованием:

```bash
bw status                 # проверить, разблокирован ли vault
# если "locked" — попроси Paul разблокировать через `bw unlock`
```

Получение item:

```bash
bw get password "parta5/AUTH_SECRET"
bw get password "parta5/postgres/local"
```

**Item'ы, которые понадобятся в Phase 0:**

| Item в Bitwarden        | Где используется                                                       |
| ----------------------- | ---------------------------------------------------------------------- |
| `parta5/AUTH_SECRET`    | `apps/web/.env` → `AUTH_SECRET` (генерация: `openssl rand -base64 32`) |
| `parta5/postgres/local` | `apps/web/.env` и `packages/db/.env` → пароль для локального Postgres  |

**Если item'а нет** — сгенерируй значение, попроси Paul положить его в Bitwarden с указанным именем, потом продолжай. Не коммить значения секретов в репозиторий. В коммит идут только `.env.example` с плейсхолдерами.

---

## Чек-лист

- [x] Шаг 1 — инициализация монорепо
- [ ] Шаг 2 — Next.js 15 + Tailwind в `apps/web`
- [ ] Шаг 3 — Prisma schema и миграция в `packages/db`
- [ ] Шаг 4 — Row Level Security + Prisma middleware для мульти-тенантности
- [ ] Шаг 5 — Auth.js v5 с email/password, страницы `/signup` и `/login`
- [ ] Шаг 6 — tRPC v11 + базовые роутеры
- [ ] Шаг 7 — UI редактора курса (`/courses`, `/courses/new`, `/courses/[id]/edit`)
- [ ] Шаг 8 — UI ученика (`/learn`, `/learn/[courseId]`) + модель `LessonCompletion`
- [ ] Шаг 9 — Docker Compose для self-host
- [ ] Шаг 10 — GitHub Actions CI + ADR-001

---

## Шаг 1 — инициализация монорепо

**Цель:** базовая структура монорепо на pnpm + Turborepo, корневые конфиги, лицензия.

**Что сделать:**

1. `git init` в корне (если ещё не сделан).
2. Создай `package.json` в корне с `"private": true`, без зависимостей, со скриптами:
   - `dev`, `build`, `lint`, `typecheck`, `test` — все проксируют в `turbo run <name>`.
   - `prepare` — `husky`.
3. `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```
4. `turbo.json` с пайплайнами `build` (зависит от `^build`, кеширует `.next/**` и `dist/**`), `lint`, `typecheck`, `test`, `dev` (persistent: true, cache: false).
5. Корневой `tsconfig.json` (base) с `strict: true`, `target: "ES2022"`, `moduleResolution: "bundler"`, `lib: ["ES2022", "DOM"]`, `noEmit: true`.
6. `.gitignore`: `node_modules`, `.next`, `dist`, `.turbo`, `.env`, `.env.local`, `*.log`, `coverage`, `.DS_Store`.
7. `.editorconfig` (LF, UTF-8, indent 2 spaces).
8. `.prettierrc` (semi: true, singleQuote: true, trailingComma: "all", printWidth: 100) и `.prettierignore`.
9. Корневой `eslint.config.mjs` (flat config) с базовыми правилами для TypeScript.
10. `LICENSE` — текст MPL 2.0 ровно с https://www.mozilla.org/media/MPL/2.0/index.txt. **Не пиши свой — скопируй каноничный.**
11. Установить dev-зависимости в корне: `pnpm add -Dw typescript turbo prettier eslint typescript-eslint husky lint-staged`.
12. `npx husky init` + pre-commit hook: `pnpm lint-staged`.
13. В `package.json` добавь `"lint-staged": { "*.{ts,tsx,js,jsx,json,md}": "prettier --write" }`.
14. Создай пустые папки `apps/` и `packages/` с `.gitkeep` внутри.

**Проверка:**

```bash
pnpm install                    # должно пройти без ошибок
pnpm lint                       # должно отработать (turbo: no tasks to run — это ОК пока)
pnpm typecheck                  # аналогично
cat LICENSE | head -1           # должно начинаться с "Mozilla Public License Version 2.0"
git status                      # все изменения в индексе или uncommitted
```

**Коммит:**

```
chore: initialize pnpm + turborepo monorepo with MPL 2.0
```

---

## Шаг 2 — Next.js 15 + Tailwind в `apps/web`

**Цель:** рабочее Next.js приложение, открывается на `http://localhost:3000`.

**Что сделать:**

1. В `apps/web` создай Next.js 15 проект **вручную** (не через `create-next-app` — он мусорит). Структура:
   - `apps/web/package.json` с зависимостями: `next@15`, `react@19`, `react-dom@19`, `@types/react`, `@types/react-dom`, `typescript`.
   - `apps/web/tsconfig.json` расширяет корневой, добавляет `"jsx": "preserve"`, `"plugins": [{ "name": "next" }]`, `"paths": { "@/*": ["./*"] }`.
   - `apps/web/next.config.ts` — экспорт `NextConfig` с `experimental: { typedRoutes: true }`.
   - `apps/web/next-env.d.ts`.
   - `apps/web/app/layout.tsx` — корневой layout с `<html lang="ru">`, метатеги (title: «Парта5», description: «LMS для школ и УДО»), импорт `./globals.css`.
   - `apps/web/app/page.tsx` — главная: заголовок «Парта5», подзаголовок «LMS для школ и УДО», две кнопки `<Link>` на `/login` и `/signup` (заглушки, страниц ещё нет).
   - `apps/web/app/globals.css` — `@import "tailwindcss";` и базовые CSS-переменные.
2. Подключи Tailwind v4 (через `@tailwindcss/postcss`):
   - Добавь `tailwindcss@^4`, `@tailwindcss/postcss`, `postcss` в devDependencies.
   - `apps/web/postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } }`.
3. Header-компонент `apps/web/components/site-header.tsx` — серверный, отображает «парта5» как текстовое лого, ссылку на /login. Используй его в layout.
4. Скрипты в `apps/web/package.json`: `dev: "next dev"`, `build: "next build"`, `lint: "next lint"`, `typecheck: "tsc --noEmit"`, `start: "next start"`.
5. Корневой `.env.example` с пустыми `AUTH_SECRET=`, `DATABASE_URL=postgresql://parta5:password@localhost:5432/parta5`.

**Проверка:**

```bash
pnpm install
pnpm --filter web dev &
sleep 5
curl -s http://localhost:3000 | grep -q "Парта5" && echo OK || echo FAIL
kill %1
pnpm --filter web typecheck
pnpm --filter web build
```

**Коммит:**

```
feat(web): scaffold Next.js 15 app with Tailwind v4
```

---

## Шаг 3 — Prisma schema и миграция в `packages/db`

**Цель:** Postgres-схема с базовыми моделями, миграция, сидинг тестовых данных.

**Что сделать:**

1. Подними локальный Postgres: либо через `docker run --rm -d --name parta5-pg -p 5432:5432 -e POSTGRES_USER=parta5 -e POSTGRES_PASSWORD=<из bitwarden parta5/postgres/local> -e POSTGRES_DB=parta5 postgres:16`, либо предложи Paul поднять самому. Запиши факт в комментарий шага.
2. Создай `packages/db/package.json` с name `@parta5/db`, зависимостями `@prisma/client`, `bcryptjs`, devDependencies `prisma`, `tsx`, `@types/bcryptjs`.
3. `packages/db/prisma/schema.prisma`:
   - generator client, datasource postgresql (URL из env).
   - `extensions = [pgcrypto]` для UUID.
   - Модели:
     - `School { id Uuid @default(dbgenerated("gen_random_uuid()")), slug @unique, name, createdAt }`
     - `User { id, email @unique, hashedPassword, name, role UserRole, schoolId Uuid? (nullable для SUPER_ADMIN), school School? @relation(fields: [schoolId]), createdAt }`
     - `Course { id, schoolId, slug, title, description, status CourseStatus, createdById, school, createdBy User, modules Module[], enrollments Enrollment[], createdAt, @@unique([schoolId, slug]), @@index([schoolId]) }`
     - `Module { id, courseId, title, order Int, course, lessons Lesson[], createdAt, @@index([courseId]) }`
     - `Lesson { id, moduleId, title, order Int, module, blocks ContentBlock[], createdAt, @@index([moduleId]) }`
     - `ContentBlock { id, lessonId, type ContentBlockType, data Json, order Int, lesson, createdAt, @@index([lessonId]) }`
     - `Enrollment { id, courseId, userId, role EnrollmentRole, course, user, createdAt, @@unique([courseId, userId]), @@index([userId]) }`
   - Enums: `UserRole { SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, STUDENT, PARENT }`, `CourseStatus { DRAFT, PUBLISHED, ARCHIVED }`, `ContentBlockType { TEXT, VIDEO, FILE }`, `EnrollmentRole { TEACHER, STUDENT }`.
   - Cascading delete: Course → Module → Lesson → ContentBlock (onDelete: Cascade).
4. `packages/db/src/index.ts` — singleton PrismaClient:
   ```ts
   import { PrismaClient } from '@prisma/client';
   const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
   export const prisma = globalForPrisma.prisma ?? new PrismaClient();
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
   export * from '@prisma/client';
   ```
5. `packages/db/prisma/seed.ts`:
   - Создать школу `{ slug: 'school-1', name: 'Тестовая школа №1' }`.
   - Создать `SCHOOL_ADMIN` с email `admin@school1.test`, пароль `password` (hashed через bcrypt), привязан к школе.
   - Создать `TEACHER` `teacher@school1.test` / `password`.
   - Создать `STUDENT` `student@school1.test` / `password`.
   - Создать один черновик курса от учителя.
6. В `packages/db/package.json` добавь `"prisma": { "seed": "tsx prisma/seed.ts" }` и скрипты `db:migrate`, `db:seed`, `db:studio`.
7. В корне создай `.env` с `DATABASE_URL` (значение из Bitwarden), `.env` уже в `.gitignore`.

**Проверка:**

```bash
pnpm --filter @parta5/db exec prisma migrate dev --name init
pnpm --filter @parta5/db exec prisma db seed
pnpm --filter @parta5/db exec prisma studio &           # открывает на :5555
sleep 3
curl -s http://localhost:5555 | head -1
kill %1
```

Проверь в Prisma Studio: одна школа, три пользователя, один курс.

**Коммит:**

```
feat(db): add Prisma schema with core models and seed data
```

---

## Шаг 4 — Row Level Security + Prisma middleware

**Цель:** на уровне БД невозможно прочитать данные чужой школы.

**Что сделать:**

1. Создай SQL-миграцию вручную через `prisma migrate dev --create-only --name add_rls`:
   - Включи RLS для таблиц `Course`, `Module`, `Lesson`, `ContentBlock`, `Enrollment`.
   - Политика: `USING (school_id = current_setting('app.current_school_id', true)::uuid)`.
   - Для `Module`, `Lesson`, `ContentBlock` — добавь `school_id` denormalized колонку (для упрощения политик), заполняй через триггер при insert/update.
   - **Альтернатива (проще):** добавь `schoolId` колонку напрямую в Module/Lesson/ContentBlock в Prisma schema, заполняй явно в коде. Выбери этот путь — проще и понятнее.
2. Обнови Prisma schema: добавь `schoolId` в `Module`, `Lesson`, `ContentBlock`, индексы.
3. `packages/db/src/with-tenant.ts` — функция `withTenant(schoolId: string, fn: (tx) => Promise<T>): Promise<T>`:
   ```ts
   return prisma.$transaction(async (tx) => {
     await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
     return fn(tx);
   });
   ```
4. Все запросы из приложения в дальнейшем должны идти через `withTenant`.
5. Перегенерируй миграцию, прогони `prisma migrate dev`.
6. В сиде поправь — после создания школы её id передавай в нижние модели.

**Проверка:**

```bash
pnpm --filter @parta5/db exec prisma migrate dev
pnpm --filter @parta5/db exec prisma db seed

# тест: попытка чтения без установленного tenant
psql $DATABASE_URL -c "SELECT count(*) FROM \"Course\";"
# должно быть 0 (RLS блокирует)

psql $DATABASE_URL -c "SELECT set_config('app.current_school_id', (SELECT id::text FROM \"School\" LIMIT 1), true); SELECT count(*) FROM \"Course\";"
# должно быть 1
```

**Коммит:**

```
feat(db): add row-level security for multi-tenant isolation
```

---

## Шаг 5 — Auth.js v5 с email/password

**Цель:** регистрация школы + первого админа, логин, защита роутов.

**Что сделать:**

1. В `apps/web/package.json` добавь `next-auth@beta`, `bcryptjs`, `@parta5/db: "workspace:*"`.
2. `apps/web/auth.ts` — настройка `NextAuth` с Credentials provider, jwt strategy, callbacks для добавления `userId` и `schoolId` в session.
3. `apps/web/middleware.ts` — защищает `/admin/*`, `/courses/*`, `/learn/*` (редирект на /login если нет сессии).
4. Страницы:
   - `apps/web/app/(auth)/signup/page.tsx` — форма: имя школы, slug школы, имя админа, email, пароль. Server action: создать School + User(SCHOOL_ADMIN), `signIn('credentials')`, redirect на `/courses`.
   - `apps/web/app/(auth)/login/page.tsx` — email + пароль. Server action: `signIn`.
5. Кнопка «Выйти» в `site-header.tsx` (только если есть сессия) — server action `signOut()`.
6. `apps/web/app/api/auth/[...nextauth]/route.ts` — re-export handlers из `auth.ts`.
7. Добавь `AUTH_SECRET` в `.env` (из Bitwarden — `parta5/AUTH_SECRET`). Если в Bitwarden нет — сгенерируй `openssl rand -base64 32`, попроси Paul положить в Bitwarden, продолжай.

**Проверка:**

```bash
pnpm --filter web dev &
sleep 5
# попробуй GET /courses без сессии — должен редиректить на /login
curl -sI http://localhost:3000/courses | head -2
# попробуй signup через server action — открой страницу и зарегистрируй вторую школу
kill %1
```

Ручная проверка: открой http://localhost:3000/signup, зарегистрируй школу `Test School #2`, после signup редирект на /courses без 401.

**Коммит:**

```
feat(auth): add Auth.js v5 with credentials provider and school signup
```

---

## Шаг 6 — tRPC v11 + базовые роутеры

**Цель:** типобезопасное API для CRUD курсов, модулей, уроков, блоков.

**Что сделать:**

1. Зависимости в `apps/web`: `@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@tanstack/react-query@^5`, `zod`, `superjson`.
2. `apps/web/server/trpc.ts` — `initTRPC.context<Context>().create({ transformer: superjson })`, base procedures: `publicProcedure`, `protectedProcedure` (требует session), `schoolScopedProcedure` (требует `schoolId` в session, оборачивает в `withTenant`).
3. `apps/web/server/context.ts` — context: session из Auth.js, prisma, schoolId.
4. Роутеры в `apps/web/server/routers/`:
   - `course.ts`: `list`, `byId(id)`, `create({title, description})`, `update`, `delete`, `publish`.
   - `module.ts`: `create({courseId, title})`, `update`, `reorder({moduleId, newOrder})`, `delete`.
   - `lesson.ts`: `create({moduleId, title})`, `update`, `reorder`, `delete`.
   - `block.ts`: `create({lessonId, type: 'TEXT', data: {markdown: ''}})`, `update`, `delete`, `reorder`.
   - `enrollment.ts`: `enroll({courseId, userId, role})`, `myCourses` (для ученика).
   - `_app.ts`: композит всех роутеров.
5. `apps/web/app/api/trpc/[trpc]/route.ts` — fetch handler.
6. `apps/web/lib/trpc/client.ts` (для client components) и `apps/web/lib/trpc/server.ts` (для server components — direct caller через `createCaller`).
7. `apps/web/lib/trpc/provider.tsx` — обёртка с `QueryClient` и `TRPCProvider`, использовать в `app/layout.tsx`.

Все мутации валидируются через `zod` схемы. Все запросы скоупятся по `schoolId` из сессии — пользователь не может ничего сделать в чужой школе.

**Проверка:**

```bash
pnpm --filter web typecheck
pnpm --filter web dev &
sleep 5
# проверка: tRPC endpoint отвечает
curl -s http://localhost:3000/api/trpc/course.list?input=%7B%7D | head -50
kill %1
```

**Коммит:**

```
feat(api): add tRPC v11 with course/module/lesson/block routers
```

---

## Шаг 7 — UI редактора курса

**Цель:** учитель может собрать курс с модулями, уроками и текстовыми блоками.

**Что сделать:**

1. `apps/web/components/ui/` — минимальный набор shadcn-стиля компонентов: `Button`, `Input`, `Textarea`, `Card`, `Dialog`. Не подключай всё shadcn — копируй только нужное. Стили на Tailwind.
2. Зависимости: `react-markdown`, `remark-gfm`.
3. Страницы:
   - `apps/web/app/(app)/courses/page.tsx` — список курсов школы, кнопка «Создать курс».
   - `apps/web/app/(app)/courses/new/page.tsx` — форма create (title, description). Server action → trpc.course.create.
   - `apps/web/app/(app)/courses/[id]/edit/page.tsx` — layout:
     - **Слева:** список модулей. Каждый модуль — раскрывающийся, внутри список уроков. Кнопки «+ модуль», «+ урок» в открытом модуле.
     - **Справа:** контент выбранного урока — список ContentBlock'ов. Каждый TEXT-блок: Markdown-textarea + preview через `react-markdown`. Кнопка «+ текстовый блок».
   - Все мутации — через tRPC хуки `useMutation`, оптимистично обновлять список.
4. Защити роуты ролью: `/courses/*/edit` — только для TEACHER, SCHOOL_ADMIN, SUPER_ADMIN.

**Проверка:**

Ручная:

1. Зарегистрируй школу.
2. Создай курс «Биология 7 класс».
3. Добавь модуль «Клетка».
4. Добавь урок «Строение клетки».
5. Добавь текстовый блок с Markdown: `# Клетка\n\nКлетка — это **базовая** единица...`
6. Перезагрузи страницу — всё на месте.

```bash
pnpm --filter web typecheck
pnpm --filter web build
```

**Коммит:**

```
feat(web): add course editor with modules, lessons and text blocks
```

---

## Шаг 8 — UI ученика + LessonCompletion

**Цель:** ученик проходит курс, отмечает уроки как пройденные, видит прогресс.

**Что сделать:**

1. Добавь модель в Prisma:
   ```prisma
   model LessonCompletion {
     id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     lessonId    String   @db.Uuid
     userId      String   @db.Uuid
     schoolId    String   @db.Uuid
     completedAt DateTime @default(now())
     lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
     user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@unique([lessonId, userId])
     @@index([userId])
   }
   ```
   Миграция.
2. tRPC роутер `completion.ts`: `markComplete({lessonId})`, `byCourse(courseId) → set of lessonIds`.
3. Страницы:
   - `apps/web/app/(app)/learn/page.tsx` — список курсов ученика (через `enrollment.myCourses`).
   - `apps/web/app/(app)/learn/[courseId]/page.tsx` — просмотр курса: список модулей и уроков с галочками completed, контент выбранного урока, кнопка «Отметить как пройденное».
4. На странице `/courses/[id]/edit` для учителя добавь раздел «Записать ученика»: input email + кнопка → `enrollment.enroll`.
5. В сиде запиши ученика на тестовый курс.

**Проверка:**

Ручная:

1. Учитель добавляет ученика `student@school1.test` на курс.
2. Логин под учеником.
3. На `/learn` виден курс.
4. Открываешь — проходишь уроки, отмечаешь complete, прогресс «1 из 2 уроков пройдено».
5. Перезагрузка сохраняет прогресс.

```bash
pnpm --filter web typecheck
pnpm --filter web build
```

**Коммит:**

```
feat(web): add student learn view with lesson completion tracking
```

---

## Шаг 9 — Docker Compose для self-host

**Цель:** `docker compose up` поднимает рабочую систему на чистой машине.

**Что сделать:**

1. `apps/web/Dockerfile` — multi-stage build:
   - Stage `deps`: install pnpm + dependencies (с `--frozen-lockfile`).
   - Stage `builder`: копирует исходники, генерирует Prisma client (`prisma generate`), `next build`.
   - Stage `runner`: `node:22-alpine`, копирует `.next/standalone` + `.next/static` + `public`, запускает `node server.js`.
   - В `next.config.ts` добавь `output: 'standalone'`.
2. Корневой `docker-compose.yml`:
   - `postgres:16` с volume `pgdata`, env из `.env`.
   - `redis:7-alpine` (зарезервировано для очередей, пока не используется).
   - `web` — build из `apps/web/Dockerfile`, depends_on `postgres`, env `DATABASE_URL`, `AUTH_SECRET`.
   - Networking: bridge сеть.
   - Volumes: `pgdata`.
3. `init-db.sh` — после старта Postgres запускает `prisma migrate deploy` и `prisma db seed` (один раз).
4. Обнови README — раздел «Self-host (Docker)»:
   ```bash
   cp .env.example .env
   # отредактируй .env: AUTH_SECRET (openssl rand -base64 32), DATABASE_URL
   docker compose up -d
   docker compose exec web pnpm --filter @parta5/db exec prisma migrate deploy
   docker compose exec web pnpm --filter @parta5/db exec prisma db seed
   # открой http://localhost:3000
   ```

**Проверка:**

```bash
docker compose build
docker compose up -d
sleep 15
curl -s http://localhost:3000 | grep -q "Парта5" && echo OK || echo FAIL
docker compose down
```

**Коммит:**

```
chore: add docker-compose for self-host deployment
```

---

## Шаг 10 — GitHub Actions CI + ADR-001

**Цель:** автоматические проверки на PR, документация архитектурного решения.

**Что сделать:**

1. `.github/workflows/ci.yml`:
   - Trigger: pull_request + push в main.
   - Jobs:
     - `lint`: pnpm install + `pnpm lint`.
     - `typecheck`: pnpm install + Prisma generate + `pnpm typecheck`.
     - `test`: pnpm install + `pnpm test` (vitest, пока пустой — добавь один smoke-тест `expect(true).toBe(true)` в `apps/web/__tests__/smoke.test.ts`).
   - Используй `pnpm/action-setup@v4`, `actions/setup-node@v4` с Node 22.
   - Кеширование pnpm store.
2. Подключи Vitest в корне: `pnpm add -Dw vitest @vitest/coverage-v8`. В корневом `package.json` скрипт `test: "turbo run test"`. В `apps/web/package.json` скрипт `test: "vitest run"`.
3. `docs/architecture/0001-stack.md` — ADR-001:
   - Status: accepted
   - Context: нужна LMS для школ, стек должен быть быстрым, типобезопасным, AI-native, под силу команде Paul.
   - Decision: Next.js 15 + tRPC + Prisma + Postgres.
   - Alternatives considered: FastAPI+React, NestJS+Next.js, микросервисы.
   - Consequences: + быстрый старт, + единый язык, − потенциальный bottleneck на одном узле (но Phase 0–4 не требуют распределённости).
4. `docs/architecture/0002-multi-tenancy.md` — ADR про мульти-тенантность с первого коммита через RLS + schoolId в каждой таблице.

**Проверка:**

```bash
pnpm test                       # smoke-тест зелёный
pnpm lint
pnpm typecheck
git push                        # Actions запустится автоматически, проверь в UI
```

**Коммит:**

```
chore(ci): add GitHub Actions for lint/typecheck/test + ADR-001 and ADR-002
```

---

## Финал Phase 0

После завершения шага 10:

1. Обнови `00-parta5.md` в Obsidian — отметь Phase 0 как complete, статус проекта → Phase 1.
2. Создай git tag: `git tag -a v0.1.0-phase0 -m "Phase 0 complete: skeleton + multi-tenancy + auth"`.
3. Push на GitHub и зеркало GitFlic (если уже создан).
4. Сообщи Paul, что Phase 0 закрыт, и попроси у него реальный `.mbz` из Moodle для следующей фазы импортёра (или подтверждение, что переходим к Phase 1 — UI блочного редактора с видео-блоком Kinescope).

---

## Если что-то пошло сильно не так

- `git restore .` — откатить незакоммиченные изменения текущего шага.
- `git reset --hard HEAD~1` — откатить последний коммит (только если шаг ещё не запушен).
- `pnpm install --frozen-lockfile` иногда помогает при странных ошибках зависимостей.
- Не уверен — спроси Paul, не выдумывай.

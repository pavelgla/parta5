# Парта5 — Последовательные промпты для Claude Code CLI

**Проект:** Парта5 — open-source LMS (монорепо pnpm + Turborepo)
**Стек:** Next.js 15 App Router, tRPC v11, Prisma + PostgreSQL 16 (RLS), Auth.js v5, BullMQ, MinIO, Vitest + Playwright
**Рабочая папка:** `/home/gpaul/projects/parta5`
**Запуск:** `./run-prompts.sh` или `./run-prompts.sh 5` (начать с промпта 5)

Скоуп: **Этап A (hardening) + начало Этапа B (квиз)** из `docs/SUPERPLAN.md`.
Основание: `docs/reviews/2026-07-senior-product-review.md`.

Перед запуском: `docker compose up -d db` (миграции в промптах 4 и 13 требуют живой Postgres), `.env` заполнен.
После каждого промпта скрипт делает git commit.

---

## ПРОМПТ 1: RBAC-Core — процедуры ролей в tRPC и типизация сессии

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Next.js 15 + tRPC v11 + Prisma + Auth.js v5, pnpm workspaces. Правила: TypeScript strict, без any и @ts-ignore, комментарии в коде на английском.

Задача: добавить ролевые tRPC-процедуры и строгую типизацию роли в сессии. Сейчас есть только protectedProcedure (= любой залогиненный) — это дыра безопасности.

1. В packages/db/src/index.ts посмотри что экспортируется. Добавь re-export enum UserRole из @prisma/client (там уже есть enum UserRole: SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, STUDENT, PARENT — проверь в packages/db/prisma/schema.prisma).

2. В apps/web/auth.ts:
   - Импортируй UserRole из @parta5/db.
   - В declare module 'next-auth' замени `role: string` на `role: UserRole`.
   - В jwt callback замени `?? 'STUDENT'` на `?? UserRole.STUDENT` (или 'STUDENT' satisfies UserRole) и убери каст `as { role?: string }` — типизируй через UserRole.
   - В session callback: `session.user.role = token.role as UserRole`.
   - Если есть отдельный файл типов next-auth (поищи `declare module 'next-auth'` по apps/web) — синхронизируй.

3. В apps/web/server/trpc/init.ts добавь после protectedProcedure:

   - `tenantProcedure` — расширяет protectedProcedure: если `!ctx.session.user.schoolId` — throw TRPCError UNAUTHORIZED с message 'No school context'. В next({ ctx }) прокинь `schoolId: ctx.session.user.schoolId` (уже narrowed string) и `userId: ctx.session.user.id`, чтобы роутеры использовали ctx.schoolId/ctx.userId без non-null assertion.
   - `teacherProcedure` — расширяет tenantProcedure: роль должна быть TEACHER, SCHOOL_ADMIN или SUPER_ADMIN, иначе TRPCError FORBIDDEN с message 'Teacher role required'.
   - `adminProcedure` — расширяет tenantProcedure: роль SCHOOL_ADMIN или SUPER_ADMIN, иначе FORBIDDEN 'Admin role required'.
   - Используй enum UserRole из @parta5/db, не строковые литералы.

4. Роутеры пока НЕ трогай (следующий промпт).

5. Выполни `pnpm --filter web exec tsc --noEmit` — исправь ошибки типов, если появились (например, сравнения role с литералами в apps/web/app/**: замени строковые сравнения на UserRole.X — найди их через grep "user.role").
```

---

## ПРОМПТ 2: RBAC-Routers — ролевые процедуры и ownership во всех роутерах

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Next.js 15 + tRPC v11 + Prisma (RLS-мультитенантность через withTenant). TypeScript strict.

Контекст: в apps/web/server/trpc/init.ts уже есть процедуры tenantProcedure (даёт ctx.schoolId: string, ctx.userId: string), teacherProcedure (TEACHER/SCHOOL_ADMIN/SUPER_ADMIN), adminProcedure (SCHOOL_ADMIN/SUPER_ADMIN). Роутеры в apps/web/server/routers/ пока используют protectedProcedure и `ctx.session.user.schoolId!` — это нужно исправить.

Задача: применить ролевые процедуры и ownership-проверки.

1. Создай apps/web/server/services/authz.ts с helper:
   `assertCanEditCourse(tx, courseId: string, userId: string, role: UserRole): Promise<void>` —
   загружает course (select id, createdById), NOT_FOUND если нет; если role === SCHOOL_ADMIN или SUPER_ADMIN — разрешено; если TEACHER и course.createdById === userId — разрешено; иначе TRPCError FORBIDDEN 'Not your course'. tx — Prisma transaction client (тип возьми как в withTenant из packages/db/src/with-tenant.ts).

2. Во ВСЕХ роутерах (course, module, lesson, block, enrollment, learn, progress, file, video, events, embed):
   - Замени `const schoolId = ctx.session.user.schoolId!` на использование tenantProcedure и `ctx.schoolId`; `ctx.session.user.id` → `ctx.userId`. Non-null assertion `schoolId!` не должен остаться нигде (проверь grep 'schoolId!').

3. course.ts: create/update/delete/publish/unpublish/archive → teacherProcedure. В update/delete/publish/unpublish/archive внутри withTenant первым делом вызывай assertCanEditCourse. list/get/validate оставь tenantProcedure.

4. module.ts, lesson.ts, block.ts: все мутации → teacherProcedure. Каждая мутация должна резолвить courseId цели (module → course, lesson → module → course, block → lesson → module → course; для create courseId/moduleId/lessonId уже в input) и вызывать assertCanEditCourse. Читающие процедуры → tenantProcedure.

5. file.ts, video.ts: requestUpload/confirmUpload(ed)/delete → teacherProcedure (загрузка контента — прерогатива учителя). getAsset/getVideo/listMyVideos → tenantProcedure.

6. events.ts: recent → adminProcedure (сейчас там ручная проверка роли — убери её, роль проверяет процедура).

7. enrollment.ts, learn.ts, progress.ts, embed.ts: → tenantProcedure (студентские сценарии).

8. Выполни `pnpm --filter web exec tsc --noEmit`, затем `pnpm --filter web exec next build` — исправь все ошибки.
```

---

## ПРОМПТ 3: RLS-Extend — политики на 4 непокрытые таблицы

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Prisma + PostgreSQL 16 c Row Level Security. Мультитенантность: политика `school_isolation` проверяет `"schoolId" = current_setting('app.current_school_id', true)::uuid`; переменная ставится через withTenant() (packages/db/src/with-tenant.ts).

Проблема: RLS включена только для Course/Module/Lesson/ContentBlock/Enrollment (миграция packages/db/prisma/migrations/20260525213546_add_rls/migration.sql — посмотри её как образец) и LessonCompletion. Таблицы BlockView, FileAsset, VideoAsset, LearningEvent имеют schoolId, но БЕЗ политик, а код местами ходит мимо withTenant голым prisma.

Задача:

1. Создай новую миграцию каталогом packages/db/prisma/migrations/<timestamp>_rls_remaining_tables/migration.sql (timestamp в формате существующих миграций, больше последней). Для каждой из таблиц "BlockView", "FileAsset", "VideoAsset", "LearningEvent" — по образцу существующей миграции:
   ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ... FORCE ROW LEVEL SECURITY;
   CREATE POLICY school_isolation ON ... USING ("schoolId" = current_setting('app.current_school_id', true)::uuid) WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

2. Примени: `docker compose up -d db` уже сделан снаружи; выполни `pnpm --filter @parta5/db exec prisma migrate deploy` (DATABASE_URL из .env). Если lint-staged/prettier переформатирует SQL — это ок (известный паттерн checksum drift).

3. Переведи обход RLS на withTenant:
   - apps/web/server/routers/video.ts — все обращения к prisma.videoAsset/prisma.fileAsset замени на withTenant(ctx.schoolId, (tx) => tx....). Импорт withTenant из '@parta5/db'.
   - apps/web/server/routers/events.ts — то же для learningEvent.
   - apps/web/server/services/learning-events.ts — logEvent должен писать через withTenant(params.schoolId, ...). Сохрани fire-and-forget семантику (ошибки — в console.error как сейчас).
   Ручные фильтры where: { schoolId } можно оставить (защита в глубину), но транзакция обязана идти через withTenant.

4. Выполни `pnpm --filter web exec tsc --noEmit` и `pnpm --filter web exec next build` — исправь ошибки.
```

---

## ПРОМПТ 4: DB-Role — непривилегированная роль приложения parta5_app

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Prisma + PostgreSQL 16 с FORCE ROW LEVEL SECURITY.

Проблема: приложение подключается к Postgres ролью parta5 — владельцем БД. FORCE RLS для владельца работает, но любое право суперпользователя/BYPASSRLS сводит изоляцию на нет, и это против ADR-002. Нужна отдельная роль приложения без DDL-прав.

Задача:

1. Создай docker/postgres-init/01-app-role.sh (bash, будет монтироваться в /docker-entrypoint-initdb.d):
   - Через psql создаёт роль: CREATE ROLE parta5_app LOGIN PASSWORD '<из env POSTGRES_APP_PASSWORD>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
   - GRANT CONNECT ON DATABASE parta5 TO parta5_app; GRANT USAGE ON SCHEMA public TO parta5_app;
   - Используй "${POSTGRES_APP_PASSWORD}" из окружения контейнера; скрипт идемпотентный (DO $$ ... IF NOT EXISTS).

2. Создай миграцию packages/db/prisma/migrations/<timestamp>_grant_app_role/migration.sql (timestamp больше последней миграции):
   - DO-блок: если роль parta5_app существует — GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO parta5_app; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO parta5_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parta5_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO parta5_app;
   - Если роли нет (локальный dev со старой БД) — RAISE NOTICE и пропустить, миграция не должна падать.

3. В docker-compose.yml:
   - Сервису db добавь volume `./docker/postgres-init:/docker-entrypoint-initdb.d:ro` и environment POSTGRES_APP_PASSWORD: ${POSTGRES_APP_PASSWORD}.
   - Сервисам web и worker поменяй DATABASE_URL на postgresql://parta5_app:${POSTGRES_APP_PASSWORD}@db:5432/parta5.
   - Сервис migrate ОСТАВЬ на роли parta5 (миграции требуют DDL).

4. В .env.example добавь POSTGRES_APP_PASSWORD=CHANGE_ME с комментарием (на английском) что это least-privilege роль приложения; в корневой .env добавь строку POSTGRES_APP_PASSWORD= с любым dev-значением, если .env существует.

5. В README.md в раздел быстрого старта добавь примечание: для существующих установок роль создаётся вручную (одна команда psql — приведи её).

6. Применение локально: выполни `pnpm --filter @parta5/db exec prisma migrate deploy` (роль может не существовать в локальной dev-БД — миграция обязана пройти с NOTICE). Затем `pnpm --filter web exec tsc --noEmit`.
```

---

## ПРОМПТ 5: Compose-Fix — env для web, закрытые порты, healthchecks

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5». Философия: школа делает `docker compose up -d` и всё работает автономно.

Проблема в docker-compose.yml: сервис web получает только DATABASE_URL/AUTH_SECRET — без S3 и Redis env, поэтому загрузка файлов/видео и постановка BullMQ-задач из веба в compose-стенде сломаны. Redis торчит наружу на 6379 без пароля, консоль MinIO наружу на 9001.

Задача — правки docker-compose.yml:

1. Сервису web добавь в environment все переменные, которые уже есть у worker: REDIS_URL=redis://redis:6379, S3_ENDPOINT=http://minio:9000, S3_REGION=${S3_REGION:-us-east-1}, S3_ACCESS_KEY_ID=${MINIO_ROOT_USER}, S3_SECRET_ACCESS_KEY=${MINIO_ROOT_PASSWORD}, S3_BUCKET=${S3_BUCKET}, S3_PUBLIC_URL=${S3_PUBLIC_URL}, S3_FORCE_PATH_STYLE=true. Сверь точные имена переменных с packages/storage/src/ (как читается конфиг) и apps/web/server/routers/video.ts (как создаётся Queue) — имена должны совпадать с кодом, а не со списком выше, если код читает другие.
2. web: добавь depends_on redis (condition: service_started) и minio.
3. redis: убери проброс портов '6379:6379' (внутри compose-сети порт и так доступен).
4. minio: убери '9001:9001' (консоль); '9000:9000' оставь — браузеру нужен доступ для presigned-загрузок.
5. redis: добавь healthcheck (redis-cli ping); minio: healthcheck (mc ready local || curl -f http://localhost:9000/minio/health/live); worker: depends_on redis condition: service_healthy.
6. Проверь `docker compose config -q` — файл должен валидироваться без ошибок.
7. Выполни `pnpm --filter web exec tsc --noEmit` (не должно быть затронуто, но убедись).
```

---

## ПРОМПТ 6: Enrollment-Policy — зачисление только в PUBLISHED, убрать dev-страницы

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Next.js 15 + tRPC v11 + Prisma.

Задача 1 — политика зачисления. В apps/web/server/routers/enrollment.ts процедура enroll сейчас апсертит зачисление в ЛЮБОЙ курс по UUID, включая черновики. Исправь: внутри withTenant перед upsert загрузи course (select id, status); если не найден — TRPCError NOT_FOUND; если status !== 'PUBLISHED' — TRPCError FORBIDDEN с message 'Course is not published'. Существующий upsert и logEvent оставь.

Задача 2 — убрать dev-страницы из продакшен-приложения:
1. Удали каталоги apps/web/app/(app)/test-upload и apps/web/app/(app)/test-video целиком.
2. Найди по репо ссылки на /test-upload и /test-video (grep по apps/web, включая e2e/) и удали/поправь их.
3. Компоненты, которые эти страницы использовали (например apps/web/components/video-uploader.tsx, file-uploader), НЕ удаляй, если они используются где-то ещё — проверь grep'ом.

Проверка: `pnpm --filter web exec tsc --noEmit` и `pnpm --filter web exec next build` — исправь ошибки.
```

---

## ПРОМПТ 7: Slug-Race + TD-001 — надёжные слаги и строгая валидация block.create

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Next.js 15 + tRPC v11 + Prisma. TypeScript strict.

Задача 1 — slug-гонка. В apps/web/server/routers/course.ts процедура create генерирует slug через count() с startsWith — это гонка и коллизии после удалений (unique constraint (schoolId, slug) выстрелит как raw 500). Перепиши: попытка tx.course.create с baseSlug; при ошибке Prisma P2002 (уникальность) — повтор с суффиксом `${baseSlug}-${случайные 6 символов a-z0-9}` (функция без Math.random небезопасна — используй crypto.randomBytes из node:crypto, это server-only код); максимум 3 попытки, потом TRPCError CONFLICT. Оформи helper createWithUniqueSlug внутри файла.

Задача 2 — TD-001. Прочитай docs/TECH-DEBT.md пункт TD-001. В apps/web/server/routers/block.ts процедура create принимает данные блока как loose z.record — а update уже использует строгую схему по типам блоков. Сделай create строгим:
- Посмотри как устроена discriminated-валидация в update и где лежат zod-схемы данных блоков (поищи в apps/web/lib/ и packages/ по 'BlockType' / 'blockDataSchema').
- В create валидируй пару (type, data) той же схемой, что и update. Если TS2589 (excessively deep) мешает объединить в один z.discriminatedUnion — валидируй в two-step: сначала enum type, затем switch по type с parse соответствующей data-схемой в теле мутации.
- Обнови docs/TECH-DEBT.md: пометь TD-001 как RESOLVED с датой и одним предложением решения.

Проверка: `pnpm --filter web exec tsc --noEmit` и `pnpm --filter web exec next build`. Если есть unit-тесты (`pnpm test`) — они должны проходить.
```

---

## ПРОМПТ 8: Worker-Hardening — retry, backoff, timeout, concurrency

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5». Видео-конвейер: apps/web/server/routers/video.ts ставит BullMQ-задачу в очередь 'video-transcode', apps/worker (src/index.ts + src/jobs/transcode-video.ts) транскодирует FFmpeg → HLS → S3.

Проблемы: у продьюсера нет retry/backoff; воркер обрабатывает по 1 задаче без таймаута — один битый/гигантский файл вешает всё.

Задача:

1. apps/web/server/routers/video.ts — найди queue.add('transcode-video', ...) и добавь opts: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 }, removeOnComplete: 100, removeOnFail: 500 }.

2. apps/worker/src/index.ts — в опции Worker добавь concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2).

3. apps/worker/src/jobs/transcode-video.ts — оберни обработку таймаутом: константа TRANSCODE_TIMEOUT_MS = Number(process.env.TRANSCODE_TIMEOUT_MS ?? 30 * 60_000). Реализуй через Promise.race с таймером (clearTimeout в finally, чтобы процесс не держался). По таймауту: убей запущенный ffmpeg-процесс (fluent-ffmpeg command.kill('SIGKILL') — сохрани ссылку на команду), пометь VideoAsset status FAILED c errorMessage 'Transcode timeout', выбрось ошибку (чтобы BullMQ засчитал fail/retry). Убедись что tmp-каталог чистится в finally как раньше.

4. При attempts>1 повторная задача не должна ломаться на статусе: в начале обработчика допусти статусы TRANSCODING и FAILED как валидные для рестарта (сейчас, вероятно, ожидается только PENDING/UPLOADING — посмотри state machine в коде и сделай идемпотентно).

5. В docker-compose.yml сервису worker добавь environment WORKER_CONCURRENCY: ${WORKER_CONCURRENCY:-2} и TRANSCODE_TIMEOUT_MS: ${TRANSCODE_TIMEOUT_MS:-1800000}. В .env.example — обе переменные с комментариями.

Проверка: `pnpm --filter worker exec tsc --noEmit` (если такого скрипта нет — `pnpm --filter worker build` или tsc по tsconfig воркера), затем `pnpm --filter web exec tsc --noEmit`.
```

---

## ПРОМПТ 9: Seed-Publish + E2E — опубликованный демо-курс и честный student-journey

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Next.js 15, Prisma seed в packages/db/prisma/seed.ts, Playwright e2e в e2e/.

Проблема: демо-курс RunStart «Введение в бег для начинающих» сидится в статусе DRAFT, из-за чего e2e/student-journey.spec.ts почти целиком в test.skip и мягких ассертах «не 404» — студенческий путь фактически не проверяется. Публикация через UI требует обложку, но seed может выставить статус напрямую.

Задача:

1. packages/db/prisma/seed.ts: курсу «Введение в бег для начинающих» выставь status: 'PUBLISHED' и publishedAt: new Date() прямо в данных создания. Убедись, что student@runstart.test зачислен (Enrollment role STUDENT) на этот курс — если нет, добавь.

2. e2e/student-journey.spec.ts — перепиши в честные проверки (логин student@runstart.test / password):
   - «студент видит опубликованный курс в /learn» — БЕЗ test.skip, строгий expect на название курса;
   - «студент открывает курс и видит модули/уроки» — expect на конкретный заголовок модуля из seed (посмотри точные строки в seed.ts);
   - «студент открывает урок и видит блоки» — expect на видимый текст первого блока;
   - убери все test.skip и условные if (count > 0) ветки.

3. Добавь e2e/authz.spec.ts — негативные проверки RBAC через UI: логин студентом; переход на /courses/new и /courses (создание) не должен позволять создать курс (проверь фактическое поведение приложения: редирект, 403 или скрытая кнопка — и зафиксируй его строгим ассертом; если страница /courses доступна студенту для просмотра — проверь отсутствие кнопки создания). Минимум 2 теста.

4. README.md: убери блок-цитату «Публикация демо-курса» (она больше не нужна — курс сидится опубликованным).

5. Проверка: подними стенд как в CI не нужно; выполни `pnpm --filter web exec tsc --noEmit` и `pnpm --filter @parta5/db exec prisma db seed` против локальной БД (docker compose up -d db уже сделан; если seed падает из-за уже существующих данных — сделай seed идемпотентным upsert'ами там, где он падает). Playwright локально запускать не обязательно — он идёт в CI.
```

---

## ПРОМПТ 10: CI-Vitest + Authz-Tests — юнит-тесты авторизации и vitest в CI

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: tRPC v11 (apps/web/server), Vitest, GitHub Actions (.github/workflows/ci.yml).

Контекст: в apps/web/server/trpc/init.ts есть tenantProcedure/teacherProcedure/adminProcedure. Ролевые отказы (FORBIDDEN/UNAUTHORIZED) срабатывают в middleware ДО обращения к БД, поэтому негативные тесты не требуют Postgres.

Задача:

1. Создай apps/web/__tests__/authz.test.ts (Vitest):
   - Собери caller через createCallerFactory из apps/web/server/routers/index.ts (посмотри apps/web/server/trpc/caller.ts как это делается) с подставным Context: session для ролей STUDENT / TEACHER / SCHOOL_ADMIN и session = null.
   - Тесты (минимум):
     a) null session → course.list кидает UNAUTHORIZED;
     b) STUDENT → course.create кидает FORBIDDEN;
     c) STUDENT → course.delete кидает FORBIDDEN;
     d) STUDENT → block.create кидает FORBIDDEN;
     e) STUDENT → events.recent кидает FORBIDDEN;
     f) пользователь с schoolId: null (любая роль) → course.list кидает UNAUTHORIZED;
   - Ожидай TRPCError с конкретным code. НЕ мокай Prisma глобально, если тест не доходит до БД; если какой-то тест всё же дёргает БД — вместо него возьми другую процедуру, где middleware срабатывает раньше.

2. Убедись что vitest сконфигурирован для apps/web (vitest.config.ts есть — рядом уже лежит apps/web/__tests__/file-upload-validation.test.ts). `pnpm test` из корня должен прогонять все workspace-тесты (turbo test).

3. .github/workflows/ci.yml: в джоб check после typecheck добавь шаг `pnpm test` (unit-тесты, без БД). Не трогай e2e-джоб.

4. Проверка: `pnpm test` — все тесты зелёные; `pnpm --filter web exec tsc --noEmit`.
```

---

## ПРОМПТ 11: ADR-004 — модель оценивания (квизы)

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5». Пишется только документация, код не трогать.

Задача: создай docs/architecture/ADR-004-assessment-model.md — Architecture Decision Record о модели данных оценивания. Оформи в стиле существующих ADR (посмотри docs/architecture/ADR-002-multitenancy-rls.md: заголовок, Статус, Контекст, Решение, Последствия, Рассмотренные альтернативы). Язык — русский. Статус: accepted, дата 2026-07.

Зафиксируй решения (это утверждённый дизайн Этапа B из docs/SUPERPLAN.md — прочитай его раздел «Этап B»):

1. Модели (Prisma): QuestionBank (категории вопросов, дерево через parentId), Question (typе enum + data Json, версионирование полем version), Quiz (настройки: timeLimitSeconds, maxAttempts, passingScore, shuffleQuestions), QuizQuestion (m:n с order и points), QuizAttempt (статусы IN_PROGRESS/SUBMITTED/EXPIRED, questionsSnapshot Json), QuizResponse (answer Json, isCorrect, points). Все — с schoolId и RLS-политикой school_isolation (по ADR-002).
2. Содержимое вопроса — JSON, валидируемый zod-схемами из пакета @parta5/quiz (не БД-колонки на каждый подтип). Обоснование: гибкость типов вопросов, единая валидация на клиенте и сервере, простой импорт из Moodle XML.
3. MVP-типы вопросов: MULTICHOICE (single/multi, shuffle вариантов, feedback на вариант), TRUEFALSE, SHORTANSWER (список принимаемых ответов, case-insensitive). Обоснование цифрами: в целевой миграции (Профспецресурс, Moodle 5.0.6) 62 940 из 62 942 вопросов — multichoice. Остальные типы Moodle (matching, essay, numerical, cloze...) — после пилота.
4. Снапшот вопросов в попытке: при старте QuizAttempt текущие данные вопросов копируются в questionsSnapshot — правка вопроса учителем не меняет уже начатые/сданные попытки; пересдача идёт по актуальной версии.
5. Оценивание — чистые функции в @parta5/quiz (grade(question, answer) -> {isCorrect, points}), вызываются на submit сервером; никакой логики оценки на клиенте.
6. Попытки с дедлайном: expiresAt = startedAt + timeLimitSeconds; фоновая cron-задача в apps/worker закрывает просроченные (status EXPIRED, оценка по сохранённым ответам).
7. Альтернативы: отдельные таблицы на каждый тип вопроса (отклонено — миграции на каждый новый тип, сложные JOIN); хранение оценки только агрегатом без QuizResponse (отклонено — нельзя показать разбор ошибок и невозможен переграйд).

Проверка: файл читается, соответствует структуре других ADR. Добавь строку-ссылку на ADR-004 в docs/SUPERPLAN.md в таблицу Этапа B (задача B1 — пометь `[x]` если там чекбоксы, иначе просто упомяни «готово 2026-07»).
```

---

## ПРОМПТ 12: Quiz-Package — @parta5/quiz: схемы вопросов и auto-grade

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо pnpm + Turborepo, LMS «Парта5». TypeScript strict, без any. Прочитай docs/architecture/ADR-004-assessment-model.md — это дизайн, который ты реализуешь.

Задача: создать пакет packages/quiz (@parta5/quiz) — чистая доменная логика без зависимостей от Next.js/Prisma. Только zod + typescript. Устройство пакета скопируй с packages/video (package.json, tsconfig, exports, vitest).

1. src/schemas.ts — zod-схемы данных вопросов:
   - multichoiceQuestionData: { prompt: string (HTML), single: boolean, shuffleChoices: boolean, choices: Array<{ id: string, text: string, correct: boolean, feedback?: string }> (min 2), defaultPoints: number (>0, default 1) };
   - truefalseQuestionData: { prompt: string, correctAnswer: boolean, defaultPoints: number };
   - shortanswerQuestionData: { prompt: string, acceptedAnswers: string[] (min 1), caseSensitive: boolean (default false), defaultPoints: number };
   - questionData = z.discriminatedUnion по полю type: 'MULTICHOICE' | 'TRUEFALSE' | 'SHORTANSWER';
   - схемы ответов: multichoiceAnswer { choiceIds: string[] }, truefalseAnswer { value: boolean }, shortanswerAnswer { text: string }.
   Экспортируй типы через z.infer.

2. src/grade.ts — чистые функции:
   - gradeQuestion(question: QuestionData, answer: unknown, points: number): { isCorrect: boolean, earnedPoints: number, feedback?: string }.
   - MULTICHOICE single: полный балл за единственный правильный выбор, 0 иначе (и 0 если выбрано больше одного). MULTICHOICE multi: частичный балл = (выбрано правильных / всего правильных) − (выбрано неправильных / всего вариантов), кламп в [0..1], умножить на points; isCorrect = точное совпадение множеств.
   - TRUEFALSE: полный балл/0.
   - SHORTANSWER: trim, схлопнуть повторные пробелы; сравнение с каждым acceptedAnswers (caseSensitive из данных); полный балл/0.
   - Невалидный answer (не парсится схемой) → { isCorrect: false, earnedPoints: 0 } — НЕ исключение.
   - gradeAttempt(items: Array<{ question: QuestionData, points: number, answer: unknown }>): { score, maxScore, results[] }.

3. __tests__/grade.test.ts + __tests__/schemas.test.ts — Vitest, покрой все ветки: оба режима multichoice (включая частичный балл и кламп нуля), truefalse, shortanswer (регистр, пробелы), невалидные ответы, пустой attempt. Ориентир — 100% покрытия grade.ts.

4. Подключи пакет: name "@parta5/quiz", private, workspace. Убедись что turbo test/typecheck его подхватывает (посмотри turbo.json и package.json других пакетов).

5. Проверка: `pnpm --filter @parta5/quiz test` зелёный; `pnpm test` из корня зелёный; `pnpm --filter web exec tsc --noEmit` не сломан.
```

---

## ПРОМПТ 13: Quiz-Models — Prisma-модели квизов + миграция + RLS

```
Ты работаешь в папке /home/gpaul/projects/parta5 — монорепо LMS «Парта5»: Prisma + PostgreSQL 16, RLS-мультитенантность (см. docs/architecture/ADR-002 и миграцию packages/db/prisma/migrations/20260525213546_add_rls/migration.sql как образец политик). Дизайн моделей — docs/architecture/ADR-004-assessment-model.md, прочитай его.

Задача: добавить модели оценивания в packages/db/prisma/schema.prisma (стиль — как существующие модели: uuid id, schoolId, createdAt/updatedAt, named relations):

1. enum QuestionType { MULTICHOICE TRUEFALSE SHORTANSWER }
   enum QuizAttemptStatus { IN_PROGRESS SUBMITTED EXPIRED }

2. model QuestionBank: id, schoolId, name, parentId (self-relation "BankTree", optional), createdById → User, timestamps. @@index([schoolId]).

3. model Question: id, schoolId, bankId → QuestionBank (onDelete: Cascade), type QuestionType, name (короткое имя для списка), data Json, version Int @default(1), createdById → User, timestamps. @@index([schoolId, bankId]).

4. model Quiz: id, schoolId, title, description String?, timeLimitSeconds Int?, maxAttempts Int? (null = безлимит), passingScore Float?, shuffleQuestions Boolean @default(false), status enum использовать существующий подход курса НЕ нужно — квиз живёт внутри курса, поле не добавляй; createdById → User, timestamps. @@index([schoolId]).

5. model QuizQuestion: quizId → Quiz (Cascade), questionId → Question (Restrict), order Int, points Float @default(1), schoolId. @@unique([quizId, questionId]), @@index([quizId, order]).

6. model QuizAttempt: id, schoolId, quizId → Quiz (Cascade), userId → User, status QuizAttemptStatus @default(IN_PROGRESS), startedAt @default(now()), submittedAt DateTime?, expiresAt DateTime?, score Float?, maxScore Float, questionsSnapshot Json, timestamps. @@index([schoolId, quizId, userId]), @@index([status, expiresAt]) (для cron просроченных).

7. model QuizResponse: id, schoolId, attemptId → QuizAttempt (Cascade), questionId (uuid, БЕЗ FK на Question — вопрос заморожен в снапшоте), answer Json, isCorrect Boolean?, earnedPoints Float?, updatedAt. @@unique([attemptId, questionId]).

8. Обнови model User/School/QuestionBank обратными relation-полями, чтобы prisma validate проходил.

9. Миграция: `docker compose up -d db` сделан снаружи; выполни `pnpm --filter @parta5/db exec prisma migrate dev --name quiz_models`. Затем создай ВТОРУЮ миграцию <timestamp>_quiz_rls/migration.sql вручную: ENABLE + FORCE ROW LEVEL SECURITY + CREATE POLICY school_isolation (USING + WITH CHECK по "schoolId", образец — 20260525213546_add_rls) для таблиц "QuestionBank", "Question", "Quiz", "QuizQuestion", "QuizAttempt", "QuizResponse". Применй `prisma migrate deploy`.

10. Проверка: `pnpm --filter @parta5/db exec prisma validate`, `pnpm --filter @parta5/db exec prisma generate`, `pnpm --filter web exec tsc --noEmit`, `pnpm test` — всё зелёное.
```

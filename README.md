<p align="center">
  <img src="./logo.svg" alt="Парта5" width="320">
</p>

<p align="center">
  <strong>Open-source LMS для средних школ и учреждений дополнительного образования РФ.</strong><br>
  Простой self-host · AI-native · ЕСИА и ФГИС из коробки · 152-ФЗ и реестр отечественного ПО.
</p>

<p align="center">
  <a href="https://parta5.ru">parta5.ru</a> ·
  <a href="./01-analysis-and-plan.md">Стратегический план</a> ·
  <a href="./CLAUDE.md">Для разработчиков</a>
</p>

---

## Статус

🟢 **Phase 1 — завершён.** Полноценный блочный редактор курсов, self-hosted видео через FFmpeg+HLS, прогресс по блокам, publishing workflow. Следующий этап — hardening и квиз-движок, см. [`docs/SUPERPLAN.md`](./docs/SUPERPLAN.md).

## Demo / Быстрый старт

```bash
git clone https://github.com/your-org/parta5.git
cd parta5
cp .env.example .env
# Отредактируй AUTH_SECRET и S3-credentials в .env
docker compose up -d
pnpm install
pnpm --filter @parta5/db exec prisma migrate deploy
pnpm --filter @parta5/db exec prisma db seed
pnpm --filter web dev
```

Открой http://localhost:3000/login и войди как:

| Роль               | Email                 | Пароль   |
| ------------------ | --------------------- | -------- |
| Администратор      | admin@school1.test    | password |
| Учитель            | teacher@school1.test  | password |
| Ученик             | student@school1.test  | password |
| Учитель (RunStart) | teacher@runstart.test | password |
| Ученик (RunStart)  | student@runstart.test | password |

> **Публикация демо-курса.** Демо-курс «Введение в бег для начинающих» создан в статусе DRAFT (без обложки). Чтобы опубликовать: войди как `teacher@runstart.test` → откройте курс → Settings → загрузи обложку → нажми «Опубликовать».

> **Существующие установки.** Приложение (web/worker) подключается к БД под least-privilege ролью `parta5_app`, не под владельцем `parta5` (см. ADR-002 — FORCE RLS работает только пока роль без BYPASSRLS). Новые `docker compose up` окружения создают её автоматически через `docker/postgres-init/01-app-role.sh`. Для БД, поднятых до этого изменения, создай роль вручную одной командой psql:
>
> ```bash
> psql "$DATABASE_URL" -c "CREATE ROLE parta5_app LOGIN PASSWORD '<POSTGRES_APP_PASSWORD>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; GRANT CONNECT ON DATABASE parta5 TO parta5_app; GRANT USAGE ON SCHEMA public TO parta5_app;"
> ```
>
> После этого выполни `pnpm --filter @parta5/db exec prisma migrate deploy`, чтобы применить гранты на таблицы, и обнови `DATABASE_URL` в окружении web/worker на пользователя `parta5_app`.

## Что умеет MVP (Phase 0 + Phase 1)

- **Мульти-тенантность с первого коммита** — каждая запись принадлежит школе; PostgreSQL Row Level Security.
- **Регистрация школы** — создаёт school + первого admin за один шаг.
- **Блочный редактор курсов** — 12 типов блоков: Заголовок, Текст, Список, Изображение, Видео (self-hosted), Видео-ссылка, Файл, Заметка (callout), Код, Цитата, Разделитель, Iframe.
- **Self-hosted видео через HLS** — загрузка файла → FFmpeg-воркер → транскодинг в 360p/720p/1080p → HLS-сегменты в S3 → HLS.js плеер. Никакого обязательного внешнего SaaS.
- **Универсальный embed** — YouTube, RuTube, VK, Kinescope, Vimeo, Boomstream одним URL.
- **Publishing workflow** — DRAFT → PUBLISHED → ARCHIVED с валидацией (обложка, subject, gradeLevel, shortDescription).
- **Прогресс ученика** — отслеживание просмотра блоков, автоматическое завершение урока когда все блоки пройдены.
- **Журнал событий (xAPI-like)** — append-only таблица `learning_event` для аналитики.
- **Объектное хранилище** — загрузка файлов через presigned URL, MinIO для self-host или любой S3-совместимый сервис.
- **E2E тесты** — Playwright (auth, course creation, student journey).

## Видео в Парта5

### Self-hosted (рекомендуется для self-host установок)

Загрузка видеофайла → BullMQ-задача → FFmpeg-воркер → HLS-транскодинг (360p/720p/1080p, `master.m3u8` + сегменты) → S3/MinIO. Плеер — HLS.js с адаптивным битрейтом. Школа полностью автономна: `docker compose up` — и всё работает без внешних сервисов.

### Универсальный embed

Для школ, у которых видео уже есть на YouTube или другом хостинге — вставь ссылку, система автоматически определит провайдера (YouTube, RuTube, VK, Kinescope, Vimeo, Boomstream) и создаст безопасный iframe.

Коммерческие SaaS-видеохостинги (Kinescope, Boomstream и т.д.) — опциональные модули, не входят в открытое ядро.

## Зачем

Школы РФ массово сидят на Moodle — потому что он бесплатный и self-host. Но Moodle сложно поднять и сложно использовать: UX из 2010-х, монолит на PHP, AI прикручен сверху. Платные SaaS (Skillspace, iSpring, Teachbase) ориентированы на корпоративное обучение и не подходят для средних школ.

**Парта5** — альтернатива для школьного сегмента:

- **Простой self-host.** Один `docker-compose up`, школьный сисадмин справится за час.
- **AI-нативно.** Встроенный генератор тестов из материалов курса, AI-тьютор с RAG по курсу, авто-конспекты видео.
- **Современный UX.** Блочный редактор курсов вместо WYSIWYG из 2010-х. Учитель собирает первый урок за 15 минут без чтения мануала.
- **Гос-интеграции из коробки.** ЕСИА (Госуслуги) для логина учителей и родителей, ФГИС «Моя школа», синхронизация оценок с Дневник.ру и ЭлЖур.
- **Родительский кабинет в MVP**, не «потом».
- **Миграция из Moodle** — импорт `.mbz` и банков вопросов Moodle XML (в разработке; GIFT / QTI 2.0 — позже).
- **152-ФЗ и реестр отечественного ПО** с первого дня.

## Стек

- **Frontend + Backend:** Next.js 15 (App Router) + tRPC
- **БД:** PostgreSQL + Prisma, мульти-тенантность через `school_id` + Row Level Security
- **Хранилище:** S3-совместимое (Yandex Object Storage / VK Cloud / MinIO для self-host)
- **Очереди:** Redis + BullMQ
- **Видео:** self-hosted (FFmpeg + HLS + HLS.js плеер) + универсальный embed (YouTube/RuTube/VK/Kinescope/Vimeo/Boomstream)
- **Auth:** Auth.js + ЕСИА OIDC
- **AI:** OpenAI API + Anthropic API + pgvector для RAG
- **Уведомления:** SMTP + Telegram Bot API

## Стандарты в дорожной карте

Сейчас реализован xAPI-подобный журнал событий (`learning_event`). Остальное — в разработке по фазам: Moodle `.mbz` / Moodle XML (Этап C), SCORM 1.2 · H5P · LTI 1.3 Advantage · GIFT / QTI 2.0 (Этап F). Актуальный статус — в [`docs/SUPERPLAN.md`](./docs/SUPERPLAN.md).

## Скриншоты

[скриншот: редактор курса — добавление блоков]  
[скриншот: ученик — урок с прогрессом по блокам]  
[скриншот: gradebook (Phase 2)]

> Реальные скриншоты будут добавлены после запуска демо-стенда.

## Дорожная карта

| Фаза | Срок    | Содержание                                                                                                                          |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0    | 2 нед   | Скелет: Next.js + Prisma + Postgres, мульти-тенантность, аутентификация                                                             |
| 1    | 4–6 нед | Курсы, модули, уроки, блочный редактор, self-hosted видео (HLS) + embed                                                             |
| A    | 1–2 нед | Hardening: RBAC, RLS на все таблицы, продакшен-готовый compose                                                                      |
| B    | 2–3 нед | Банк вопросов, тесты (multichoice/truefalse/shortanswer), авто-оценка                                                               |
| C    | 2–3 нед | Импорт `.mbz` из Moodle, импорт банков вопросов                                                                                     |
| D    | 2 нед   | Управление пользователями, CSV-ростер, пилот на реальном контенте                                                                   |
| E–H  | далее   | Задания и уведомления · аналитика и стандарты (SCORM/H5P/LTI, AI) · ЕСИА/ФГИС/дневники и родительский кабинет · биллинг и реестр ПО |

Подробности — в [`docs/SUPERPLAN.md`](./docs/SUPERPLAN.md) и [`01-analysis-and-plan.md`](./01-analysis-and-plan.md).

## Лицензия

[Mozilla Public License 2.0](./LICENSE). Бесплатное использование, изменения в ядре возвращаются в сообщество, проприетарные надстройки и платные модули разрешены.

## Контакты

Paul · pavelgladyshev1976@gmail.com · Петрозаводск, Карелия

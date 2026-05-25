# Phase 1 — MVP контент + видео

> Исполнительный сценарий для Claude Code. Прочитай этот файл целиком, прочитай `CLAUDE.md`, проверь, что Phase 0 закрыт (`git tag --list "v0.1.0-phase0"`), потом выполняй шаги строго по порядку.

**Цель фазы:** превратить скелет из Phase 0 в полноценный редактор курсов, в котором учитель собирает урок из разных типов блоков (текст, заголовки, изображения, видео, файлы, выноски, код), грузит файлы в S3, встраивает видео из Kinescope, а ученик проходит курс с трекингом прогресса на уровне блоков и сохранением xAPI-like событий.

**После завершения** Paul должен иметь возможность собрать на платформе реальный курс школы бега RunStart как первый пилотный курс.

---

## Правила выполнения

Те же, что в `phase-0.md`. Кратко:

1. Перед каждым шагом — `git status` чистый.
2. Выполняй ровно то, что описано в шаге.
3. Прогоняй проверки. Если красные — исправляй, не двигайся дальше.
4. Коммить с сообщением из «Коммит».
5. Отмечай галочку в чек-листе → коммит `chore: mark phase1 step N complete`.

Если шаг **не получается** — НЕ выдумывай. Остановись, опиши проблему, спроси Paul.

---

## Секреты через Bitwarden

Новые item'ы для Phase 1:

| Item в Bitwarden                      | Где используется                  | Как получить                                                                                              |
| ------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `parta5/kinescope/api-token`          | Загрузка видео и проверка статуса | Зарегистрируйся на kinescope.io → Settings → API → создай токен. Тариф «Старт» бесплатный для разработки. |
| `parta5/s3/minio-local-root-user`     | Локальный MinIO                   | Сгенерируй (можно `parta5admin`), положи в Bitwarden                                                      |
| `parta5/s3/minio-local-root-password` | Локальный MinIO                   | Сгенерируй `openssl rand -hex 24`, положи в Bitwarden                                                     |
| `parta5/s3/bucket-name`               | Имя бакета                        | По умолчанию `parta5-uploads`                                                                             |

Если какого-то item'а нет — сгенерируй значение, положи в Bitwarden через `bw create item`, продолжай.

---

## Чек-лист

- [ ] Шаг 1 — расширить модель `ContentBlock` (12 типов блоков) + миграция
- [ ] Шаг 2 — S3-хранилище: MinIO в docker-compose + `@parta5/storage` пакет
- [ ] Шаг 3 — загрузка файлов: `FileAsset` модель + presigned URLs + UI-компонент
- [ ] Шаг 4 — интеграция Kinescope: API клиент + загрузка + embed + webhook'и
- [ ] Шаг 5 — блочный редактор Notion-style с TipTap и `dnd-kit`
- [ ] Шаг 6 — расширенные метаданные курса: cover, предмет, класс, rich-text описание
- [ ] Шаг 7 — трекинг прогресса на уровне блоков (`BlockView` + IntersectionObserver + Kinescope events)
- [ ] Шаг 8 — таблица `LearningEvent` (xAPI-like) + API логирования
- [ ] Шаг 9 — publishing flow: DRAFT → PUBLISHED → ARCHIVED + превью + валидация
- [ ] Шаг 10 — демо-курс + e2e тесты в Playwright + обновление README

---

## Шаг 1 — расширить модель `ContentBlock`

**Цель:** поддержать все типы блоков для богатого редактора, без UI пока — только данные и API.

**Что сделать:**

1. В `packages/db/prisma/schema.prisma` расширь enum:
   ```prisma
   enum ContentBlockType {
     HEADING        // h1/h2/h3, data: { level: 1|2|3, text: string }
     TEXT           // rich text, data: { html: string, text: string } — html генерируется из TipTap
     LIST           // data: { ordered: bool, items: string[] }
     IMAGE          // data: { fileAssetId: uuid, caption?: string, alt?: string }
     VIDEO_EMBED    // YouTube/RuTube/VK, data: { provider: 'youtube'|'rutube'|'vk', url: string, embedUrl: string }
     VIDEO_KINESCOPE  // data: { kinescopeVideoId: string, posterUrl?: string, durationSeconds?: number }
     FILE           // data: { fileAssetId: uuid, displayName: string }
     CALLOUT        // data: { variant: 'info'|'warning'|'success'|'danger', text: string }
     CODE           // data: { language: string, code: string }
     QUOTE          // data: { text: string, author?: string }
     DIVIDER        // data: {}
     EMBED_IFRAME   // generic iframe, data: { url: string, height: number } — для admin only, не для учителей
   }
   ```
2. Удали старые семена TEXT-блоков, которые не подходят под новую структуру. Перепиши сид: используй HEADING + TEXT + DIVIDER.
3. В Prisma schema добавь зависимости:
   - `FileAsset` уже понадобится в шаге 3 — пока не добавляй.
   - Для CODE-блока — никаких внешних таблиц.
4. Создай миграцию: `prisma migrate dev --name expand_content_block_types`.
5. Обнови tRPC роутер `block.ts`:
   - `create({lessonId, type, data})` — `data` валидируй через zod discriminated union по `type`. Все 12 вариантов schemas в отдельном файле `apps/web/server/schemas/block-data.ts`.
   - `update({id, data})` — аналогичная валидация.
   - `reorder({lessonId, blockIds: string[]})` — атомарно переставляет order.

**Проверка:**

```bash
pnpm --filter @parta5/db exec prisma migrate dev
pnpm --filter @parta5/db exec prisma db seed
pnpm --filter web typecheck

# Через tRPC создай блоки разных типов:
# (можно использовать prisma studio для ручной проверки)
pnpm --filter @parta5/db exec prisma studio
# Создай руками ContentBlock с type=CALLOUT, data={variant:'info',text:'Привет'} — должен сохраниться.
```

**Коммит:**

```
feat(db): expand ContentBlock with 12 block types and zod schemas
```

---

## Шаг 2 — S3-хранилище: MinIO + пакет `@parta5/storage`

**Цель:** абстракция над S3-совместимым хранилищем, MinIO в локальном dev-стеке.

**Что сделать:**

1. В `docker-compose.yml` добавь сервис `minio`:
   ```yaml
   minio:
     image: minio/minio:latest
     command: server /data --console-address ":9001"
     ports:
       - '9000:9000' # API
       - '9001:9001' # Web console
     environment:
       MINIO_ROOT_USER: ${MINIO_ROOT_USER}
       MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
     volumes:
       - miniodata:/data
   minio-init:
     image: minio/mc:latest
     depends_on: [minio]
     entrypoint: >
       /bin/sh -c "
       mc alias set local http://minio:9000 $$MINIO_ROOT_USER $$MINIO_ROOT_PASSWORD &&
       mc mb -p local/${S3_BUCKET} &&
       mc anonymous set download local/${S3_BUCKET}/public/* || true
       "
     environment:
       MINIO_ROOT_USER: ${MINIO_ROOT_USER}
       MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
       S3_BUCKET: ${S3_BUCKET}
   ```
   Добавь volume `miniodata` в `volumes:`.
2. Обнови `.env.example`:
   ```
   MINIO_ROOT_USER=parta5admin
   MINIO_ROOT_PASSWORD=changeme
   S3_BUCKET=parta5-uploads
   S3_ENDPOINT=http://localhost:9000
   S3_REGION=us-east-1
   S3_ACCESS_KEY_ID=<same as MINIO_ROOT_USER for local>
   S3_SECRET_ACCESS_KEY=<same as MINIO_ROOT_PASSWORD for local>
   S3_PUBLIC_URL=http://localhost:9000/parta5-uploads
   ```
3. Создай пакет `packages/storage`:
   - `package.json` name `@parta5/storage`, deps: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
   - `src/index.ts` — экспорт `StorageAdapter` интерфейса:
     ```ts
     export interface StorageAdapter {
       presignUpload(
         key: string,
         contentType: string,
         sizeBytes: number,
       ): Promise<{ url: string; fields?: Record<string, string>; expiresAt: Date }>;
       publicUrl(key: string): string;
       delete(key: string): Promise<void>;
       headObject(key: string): Promise<{ size: number; contentType: string } | null>;
     }
     ```
   - `src/s3.ts` — реализация `S3StorageAdapter` использующая `@aws-sdk/client-s3` (работает и с MinIO, и с Yandex Object Storage, и с AWS S3 — endpoint конфигурируется).
   - `src/index.ts` — фабрика `createStorageFromEnv()` читает `S3_*` env и возвращает `S3StorageAdapter`.
   - Поддержка `forcePathStyle: true` для MinIO (Yandex использует virtual-hosted style — параметр).
4. Ключи в бакете формируются как `schools/<schoolId>/<assetType>/<uuid>-<originalName>`. Это требование из CLAUDE.md.
5. Юнит-тест на `createStorageFromEnv()` (mock env) — Vitest в `packages/storage/__tests__/`.

**Проверка:**

```bash
docker compose up -d minio minio-init
sleep 5
docker compose logs minio-init | grep -E "(created|already)"
# Открой http://localhost:9001 (логин/пароль из .env), убедись что бакет parta5-uploads создан

pnpm --filter @parta5/storage test
```

**Коммит:**

```
feat(storage): add S3-compatible adapter with MinIO docker service
```

---

## Шаг 3 — загрузка файлов: `FileAsset` + presigned URLs + UI

**Цель:** учитель загружает файл/картинку через браузер прямо в S3 по presigned URL, минуя сервер.

**Что сделать:**

1. В Prisma schema модель:
   ```prisma
   model FileAsset {
     id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId     String   @db.Uuid
     uploaderId   String   @db.Uuid
     key          String   @unique           // S3 object key
     originalName String
     mimeType     String
     sizeBytes    Int
     status       FileAssetStatus @default(PENDING)  // PENDING → UPLOADED → DELETED
     createdAt    DateTime @default(now())
     uploader     User     @relation(fields: [uploaderId], references: [id])
     @@index([schoolId])
     @@index([uploaderId])
   }
   enum FileAssetStatus { PENDING UPLOADED DELETED }
   ```
   Миграция.
2. tRPC роутер `file.ts` (в `apps/web/server/routers/file.ts`):
   - `requestUpload({originalName, mimeType, sizeBytes})` → создаёт `FileAsset` в статусе PENDING, возвращает `{fileAssetId, uploadUrl, key, expiresAt}`. Серверная валидация: размер ≤ 50 MB для изображений/файлов, ≤ 500 MB для видео (если type предусмотрен в будущем). MIME-whitelist (`image/*`, `application/pdf`, `application/zip`, etc.).
   - `confirmUpload({fileAssetId})` → вызывает `storage.headObject(key)`, если файл реально загружен — статус UPLOADED. Если нет — возвращает ошибку.
   - `delete({fileAssetId})` → soft delete (статус DELETED) + `storage.delete(key)`.
3. UI-компонент `apps/web/components/file-upload.tsx` (client component):
   - Props: `accept` (MIME маска), `maxSizeMB`, `onUploaded(fileAsset)`.
   - Использует `fetch(uploadUrl, { method: 'PUT', body: file })` с прогресс-баром через `XMLHttpRequest` (fetch не даёт upload progress).
   - После завершения — вызывает `confirmUpload`, потом колбэк.
4. Интеграция в редактор курсов: блок IMAGE и FILE открывают `FileUpload` модалку. После загрузки в `block.data` пишется `{fileAssetId, originalName, mimeType}`.
5. Helper `apps/web/lib/file-url.ts` — `getFileUrl(asset: FileAsset): string` возвращает `storage.publicUrl(asset.key)` (на сервере) или прокси-роут (для приватных файлов — пока не делаем, все uploaded = публичные).

**Проверка:**

Ручная:

1. Открой `/courses/[id]/edit`.
2. Добавь блок IMAGE → загрузи PNG → должен появиться в редакторе.
3. Сделай рефреш — картинка осталась.

```bash
pnpm --filter web typecheck
# unit-test для requestUpload валидации
pnpm --filter web test
```

**Коммит:**

```
feat(files): add FileAsset model and browser uploads via presigned URLs
```

---

## Шаг 4 — интеграция Kinescope

**Цель:** учитель загружает видео в Kinescope из браузера и встраивает в урок одним кликом. Webhook'и обновляют статус.

**Что сделать:**

1. Создай пакет `packages/kinescope`:
   - `package.json` name `@parta5/kinescope`, deps: `zod`.
   - `src/client.ts` — `KinescopeClient` класс с методами:
     - `createVideoUpload({title, parentId}): Promise<{videoId, uploadUrl, expiresAt}>` — POST `https://uploader.kinescope.io/v2/init` (см. их API доки).
     - `getVideo(videoId): Promise<KinescopeVideo>` — GET `/videos/{id}`.
     - `deleteVideo(videoId): Promise<void>`.
     - `verifyWebhookSignature(rawBody, signature): boolean` — HMAC-SHA256 по секрету.
   - `src/types.ts` — zod schemas для ответов API.
   - Конструктор принимает `{apiToken, webhookSecret, baseUrl?}` — токен из Bitwarden.
2. **Перед написанием кода ОБЯЗАТЕЛЬНО** прочитай актуальную документацию Kinescope API: https://documentation.kinescope.io/. API может отличаться от моего описания — следуй документации, а не моему гайду. Если расхождения — выбери документацию.
3. tRPC роутер `video.ts`:
   - `requestKinescopeUpload({title})` → вызывает `client.createVideoUpload`, сохраняет связь `Video {id, schoolId, kinescopeVideoId, title, status: 'UPLOADING', durationSeconds?: null}` в БД, возвращает `{videoId, uploadUrl}`.
   - `getVideo({videoId})` → возвращает текущий статус из БД (после первого фетча из Kinescope мы кэшируем локально).
4. Webhook handler `apps/web/app/api/webhooks/kinescope/route.ts`:
   - POST, проверяет подпись через `client.verifyWebhookSignature(rawBody, headers['x-signature'])`.
   - На события `video.transcoded` / `video.processed` обновляет `Video.status = 'READY'`, `durationSeconds`, `posterUrl`.
   - Возвращает 200 OK.
5. UI: в редакторе курсов блок VIDEO_KINESCOPE открывает модалку:
   - Title input + drag-and-drop файла.
   - При выборе файла → `requestKinescopeUpload` → upload через fetch на `uploadUrl` с прогрессом.
   - После завершения upload — блок сохраняется с `data.kinescopeVideoId`.
   - Если статус ещё `UPLOADING`/`TRANSCODING` — показывать placeholder «Видео обрабатывается».
6. Плеер: `apps/web/components/kinescope-player.tsx` (client):
   - Использует `@kinescope/react-kinescope-player` (npm пакет от вендора).
   - Props: `videoId`, `onProgress({currentTime, duration})`, `onComplete()`.
   - Onprogress эмитит события каждые 5 сек — это пригодится в шаге 7 для трекинга прогресса.
7. В `.env.example` добавь `KINESCOPE_API_TOKEN=`, `KINESCOPE_WEBHOOK_SECRET=`.

**Проверка:**

Ручная:

1. Получи Kinescope API token, положи в Bitwarden, добавь в `.env`.
2. Создай блок VIDEO_KINESCOPE в курсе.
3. Загрузи короткое видео (10 сек).
4. Подожди транскодирование (1-2 мин) — статус сменится на READY (через webhook или ручной poll).
5. Открой урок как ученик — видео играется.

```bash
pnpm --filter @parta5/kinescope test
# юнит-тест на verifyWebhookSignature
pnpm --filter web typecheck
```

**Коммит:**

```
feat(video): integrate Kinescope upload, embed and webhooks
```

---

## Шаг 5 — блочный редактор Notion-style

**Цель:** учитель собирает урок мышью — добавляет блоки через «/» меню, переставляет drag-and-drop, инлайн редактирует с автосохранением.

**Что сделать:**

1. Зависимости в `apps/web`:
   - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop.
   - `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder` — rich text для HEADING и TEXT.
   - `lucide-react` — иконки.
2. Компонент `apps/web/components/block-editor/block-editor.tsx`:
   - Props: `lessonId`, `blocks: ContentBlock[]`.
   - Рендерит список блоков через `<SortableContext>`. Каждый блок — `<SortableBlock>` с handle для drag.
   - Между блоками — `+` кнопка, открывающая `<BlockTypeMenu>` (поповер).
   - Каждый тип блока — отдельный компонент в `components/block-editor/blocks/`:
     - `HeadingBlock` (TipTap, h1/h2/h3 переключатель)
     - `TextBlock` (TipTap с базовым набором: bold, italic, link, code, lists — без heading'ов, заголовки — отдельный блок)
     - `ListBlock` (ordered/unordered)
     - `ImageBlock` (картинка + alt + caption)
     - `VideoEmbedBlock` (поле URL → детект провайдера → embed)
     - `VideoKinescopeBlock` (модалка upload или выбор из библиотеки)
     - `FileBlock` (upload + display name)
     - `CalloutBlock` (variant select + text)
     - `CodeBlock` (language select + textarea с моноширинным шрифтом, без подсветки в Phase 1)
     - `QuoteBlock`
     - `DividerBlock` (просто `<hr>`)
3. Автосохранение: каждый блок при изменении вызывает `trpc.block.update` с debounce 500ms. Индикатор «Сохранено» / «Сохраняется...» в углу страницы.
4. Drag-and-drop: при отпускании — `trpc.block.reorder({lessonId, blockIds})`. Оптимистично обновлять локальный state.
5. Слэш-меню `<BlockTypeMenu>`: 12 типов блоков с иконками и описаниями. Поиск по названию (фильтр). Кнопка enter — выбрать.
6. Поведение клавиатуры:
   - Backspace в начале пустого блока → удалить блок и переместить фокус в предыдущий.
   - Enter в TEXT блоке → создать новый TEXT блок снизу.
   - Cmd/Ctrl+Z → undo (TipTap встроенный, для остального — пока без undo).
7. Замени старую страницу `/courses/[id]/edit` правую панель на `<BlockEditor>`.

**Проверка:**

Ручная:

1. Открой `/courses/[id]/edit/[lessonId]` (новый URL для редактирования урока).
2. Добавь блоки разных типов через «/» меню.
3. Перетащи блок drag-and-drop.
4. Отредактируй текст — через 500ms видишь «Сохранено».
5. Рефреш — всё на месте.

```bash
pnpm --filter web typecheck
pnpm --filter web build
```

**Коммит:**

```
feat(editor): notion-style block editor with TipTap and dnd-kit
```

---

## Шаг 6 — расширенные метаданные курса

**Цель:** курс выглядит привлекательно — обложка, предмет, класс, нормальное описание.

**Что сделать:**

1. Расширь модель `Course`:
   ```prisma
   coverFileAssetId String?  @db.Uuid
   coverFileAsset   FileAsset? @relation(fields: [coverFileAssetId], references: [id])
   subject          String?           // school subject: 'biology', 'math', 'russian'... справочник в коде
   gradeLevel       Int?              // 5..11
   shortDescription String?           // 1-2 предложения для списков
   longDescription  Json?             // TipTap content
   ```
   Миграция.
2. Справочник предметов в `apps/web/lib/subjects.ts`:
   ```ts
   export const SCHOOL_SUBJECTS = [
     { id: 'russian', label: 'Русский язык' },
     { id: 'literature', label: 'Литература' },
     { id: 'math', label: 'Математика' },
     { id: 'algebra', label: 'Алгебра' },
     { id: 'geometry', label: 'Геометрия' },
     { id: 'biology', label: 'Биология' },
     { id: 'chemistry', label: 'Химия' },
     { id: 'physics', label: 'Физика' },
     { id: 'history', label: 'История' },
     { id: 'social-studies', label: 'Обществознание' },
     { id: 'geography', label: 'География' },
     { id: 'english', label: 'Английский язык' },
     { id: 'informatics', label: 'Информатика' },
     { id: 'pe', label: 'Физкультура' },
     { id: 'art', label: 'Изобразительное искусство' },
     { id: 'music', label: 'Музыка' },
     { id: 'technology', label: 'Технология' },
     { id: 'other', label: 'Другое' },
   ] as const;
   ```
3. Страница `/courses/[id]/edit/settings` — форма настроек курса: title, slug (с валидацией уникальности), subject (select), gradeLevel (select 5-11), shortDescription (input), longDescription (TipTap), coverFileAsset (`FileUpload`).
4. На странице `/courses` — список курсов с обложками. Сетка карточек: cover image, title, subject + grade, short description, статус (DRAFT/PUBLISHED).
5. На странице `/learn` — список курсов ученика с теми же обложками.

**Проверка:**

Ручная:

1. На `/courses/[id]/edit/settings` укажи предмет «Биология», класс 7, загрузи обложку.
2. На `/courses` карточка курса показывает обложку и метаданные.
3. На `/learn` ученик видит то же.

```bash
pnpm --filter @parta5/db exec prisma migrate dev --name course_metadata
pnpm --filter web typecheck
```

**Коммит:**

```
feat(course): add cover image, subject, grade level and rich description
```

---

## Шаг 7 — трекинг прогресса на уровне блоков

**Цель:** ученик скроллит урок, смотрит видео — система отмечает каждый блок как просмотренный, считает % прохождения.

**Что сделать:**

1. Модель `BlockView`:
   ```prisma
   model BlockView {
     id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     blockId     String   @db.Uuid
     lessonId    String   @db.Uuid
     userId      String   @db.Uuid
     schoolId    String   @db.Uuid
     viewedAt    DateTime @default(now())
     completedAt DateTime?
     watchedSeconds Int?  // для видео — сколько просмотрено
     block       ContentBlock @relation(fields: [blockId], references: [id], onDelete: Cascade)
     @@unique([blockId, userId])
     @@index([userId])
     @@index([lessonId])
   }
   ```
   Миграция.
2. tRPC роутер `progress.ts`:
   - `markBlockViewed({blockId})` — upsert BlockView со статусом viewed.
   - `markBlockCompleted({blockId, watchedSeconds?})` — обновляет completedAt.
   - `courseProgress({courseId})` → `{lessons: [{lessonId, totalBlocks, viewedBlocks, completedBlocks}]}`.
3. На странице ученика `/learn/[courseId]/[lessonId]`:
   - Каждый блок обёрнут в `<BlockTracker blockId>` (client component):
     - Использует `IntersectionObserver` — когда блок 50% в viewport ≥ 2 сек → `markBlockViewed`.
     - Для VIDEO_KINESCOPE: подключается к событиям плеера — `onProgress` каждые 5 сек обновляет watchedSeconds, при 90% просмотра → `markBlockCompleted`.
     - Для остальных типов (TEXT, IMAGE, etc) — viewed = completed автоматически (или по нажатию «Прочитано» внизу урока для всего урока, как было в Phase 0).
4. Боковая панель прогресса на `/learn/[courseId]`:
   - Список уроков с прогресс-баром (например `3/5 блоков`).
   - Общий прогресс по курсу (`78%`).
5. Обнови `LessonCompletion` из Phase 0: теперь считаем урок завершённым, если все блоки в нём completed (или 90% — настраиваемо). Триггер при `markBlockCompleted` → пересчитать `LessonCompletion`.

**Проверка:**

Ручная:

1. Открой урок как ученик.
2. Поскролль до конца — все TEXT/IMAGE блоки помечены viewed (в Prisma Studio проверь BlockView).
3. Посмотри Kinescope-видео целиком — `watchedSeconds` растёт, в конце completedAt установлен.
4. Боковая панель показывает «3/5 блоков пройдено».
5. Когда все блоки урока completed → LessonCompletion появилась.

```bash
pnpm --filter web typecheck
pnpm --filter @parta5/db exec prisma migrate dev --name block_view
```

**Коммит:**

```
feat(progress): add per-block view tracking with intersection observer and video events
```

---

## Шаг 8 — `LearningEvent` (xAPI-like) + API логирования

**Цель:** append-only журнал всех значимых действий пользователя — фундамент для аналитики и AI-фич в Phase 4-5.

**Что сделать:**

1. Модель `LearningEvent`:
   ```prisma
   model LearningEvent {
     id          BigInt   @id @default(autoincrement())
     schoolId    String   @db.Uuid
     actorId     String   @db.Uuid                   // user id
     verb        String                              // 'viewed', 'completed', 'started', 'answered', 'scored', 'enrolled'
     objectType  String                              // 'block', 'lesson', 'course', 'quiz', 'question'
     objectId    String   @db.Uuid
     result      Json?                               // { score: 0.85, duration: 120, ... }
     context     Json?                               // { ip?, userAgent?, sessionId?, ... }
     timestamp   DateTime @default(now())
     @@index([schoolId, timestamp(sort: Desc)])
     @@index([actorId, timestamp(sort: Desc)])
     @@index([objectType, objectId])
   }
   ```
   Миграция. **Никаких FK** — это append-only журнал, удалять объекты можно без cascade.
2. Сервис `apps/web/server/services/learning-events.ts`:
   ```ts
   export async function logEvent(input: {
     schoolId;
     actorId;
     verb;
     objectType;
     objectId;
     result?;
     context?;
   }): Promise<void> {
     await prisma.learningEvent.create({ data: input });
   }
   ```
   Все вызовы — fire-and-forget (try/catch с логированием ошибки, не блокировать основной flow).
3. Интегрируй вызовы `logEvent` в:
   - `enrollment.enroll` → `verb: 'enrolled', objectType: 'course'`.
   - `progress.markBlockViewed` → `verb: 'viewed', objectType: 'block'`.
   - `progress.markBlockCompleted` → `verb: 'completed', objectType: 'block', result: { watchedSeconds }`.
   - `LessonCompletion` создан → `verb: 'completed', objectType: 'lesson'`.
   - `course.publish` → `verb: 'published', objectType: 'course'`.
4. Простейшая страница `/admin/events` (только для SCHOOL_ADMIN, SUPER_ADMIN) — последние 100 событий школы в виде таблицы. Это диагностический инструмент, не для учителей.

**Проверка:**

Ручная:

1. Ученик проходит урок.
2. На `/admin/events` появились записи `viewed`, `completed` за последние минуты.

```bash
pnpm --filter web typecheck
pnpm --filter @parta5/db exec prisma migrate dev --name learning_events

# проверь индексы — для timestamp DESC должны создаться правильно
psql $DATABASE_URL -c "\d \"LearningEvent\""
```

**Коммит:**

```
feat(analytics): add xAPI-like LearningEvent append-only log
```

---

## Шаг 9 — publishing flow

**Цель:** курсы видны ученикам только после публикации; перед публикацией — валидация и превью.

**Что сделать:**

1. tRPC `course.publish({id})`:
   - Валидация:
     - У курса есть title, shortDescription, subject, gradeLevel, cover.
     - ≥1 модуль.
     - В каждом модуле ≥1 урок.
     - В каждом уроке ≥1 блок.
   - Если ОК → `status = PUBLISHED`, `publishedAt = now()`.
   - Иначе → возвращает массив ошибок `{ path, message }`.
2. tRPC `course.unpublish({id})` → `status = DRAFT`, сохраняем `publishedAt`.
3. tRPC `course.archive({id})` → `status = ARCHIVED`. Архивный курс не виден ученикам, но и не удалён.
4. На `/courses/[id]/edit/settings` — кнопка «Опубликовать»/«Снять с публикации». При публикации показываем checklist валидации.
5. `/courses/[id]/preview` — превью урока в режиме ученика (для учителя). Использует тот же UI что и `/learn`, но без записи прогресса.
6. В `enrollment.myCourses` отфильтруй — учеников записывать на DRAFT можно, но в `/learn` показываем только PUBLISHED + ARCHIVED.
7. На главной `/courses` карточка курса показывает badge статуса (зелёный «Опубликовано», серый «Черновик», красный «Архив»).
8. Добавь поле `publishedAt` в schema, миграция.

**Проверка:**

Ручная:

1. Создай курс без обложки → попробуй опубликовать → видишь ошибку валидации.
2. Дозаполни → опубликуй → статус PUBLISHED, ученик видит в `/learn`.
3. Открой `/courses/[id]/preview` → видишь курс как ученик, прогресс не пишется (`BlockView` не создаётся).
4. Сними с публикации → ученик больше не видит.

```bash
pnpm --filter web typecheck
pnpm --filter @parta5/db exec prisma migrate dev --name publishing
```

**Коммит:**

```
feat(course): add DRAFT/PUBLISHED/ARCHIVED workflow with validation and preview
```

---

## Шаг 10 — демо-курс + e2e тесты + README

**Цель:** в seed появляется красивый демо-курс с реалистичным контентом; полный flow покрыт автотестами.

**Что сделать:**

1. Перепиши `packages/db/prisma/seed.ts` — добавь демо-курс «Введение в бег для начинающих» от RunStart-учителя:
   - 3 модуля: «Зачем бегать», «Техника бега», «Первая тренировка».
   - В каждом модуле 2-3 урока.
   - Разные типы блоков в уроках: HEADING, TEXT (с rich content), IMAGE (placeholder fileAsset), VIDEO_EMBED (ссылка на короткий ролик с YouTube), CALLOUT (совет), DIVIDER.
   - Курс в статусе PUBLISHED, с обложкой, описанием, subject = 'pe' (физкультура).
   - Запиши студента на курс.
2. Зависимости в корне: `pnpm add -Dw @playwright/test`. Установи браузеры: `npx playwright install --with-deps chromium`.
3. `playwright.config.ts` в корне.
4. `e2e/` директория в корне с тестами:
   - `e2e/auth.spec.ts` — signup создаёт школу, логин работает.
   - `e2e/course-creation.spec.ts` — учитель создаёт курс, добавляет модуль, урок, разные типы блоков, публикует.
   - `e2e/student-journey.spec.ts` — ученик записан → видит курс → проходит уроки → прогресс растёт → курс на 100%.
5. CI workflow (`.github/workflows/ci.yml`) — добавь job `e2e`:
   - services: postgres, redis, minio.
   - Шаги: prisma migrate, prisma seed, build, `playwright test`.
   - Артефакты: screenshots/videos failed тестов.
6. Обнови `README.md`:
   - Скриншоты редактора и просмотра ученика.
   - Раздел «Demo» — `docker compose up`, `/login` с `admin@school1.test` / `password`.
   - Раздел «Что умеет MVP» с маркированным списком фич Phase 0+1.
7. Обнови `00-parta5.md`:
   - Phase 0 и Phase 1 — отмечено `[x]`.
   - Текущий статус → Phase 2 (тесты и задания).
   - Чек-лист на следующее: получить `.mbz` от пилотной школы, начать Phase 2.

**Проверка:**

```bash
pnpm --filter @parta5/db exec prisma migrate reset --force
pnpm --filter @parta5/db exec prisma db seed
pnpm --filter web build
pnpm --filter web start &
sleep 5

# e2e локально
pnpm exec playwright test --reporter=list

kill %1
```

E2E зелёные → всё работает.

**Коммит:**

```
test(e2e): add Playwright e2e suite and rich demo course in seed
```

---

## Финал Phase 1

После завершения шага 10:

1. Обнови `00-parta5.md` в Obsidian: Phase 1 → `[x]`, статус → Phase 2.
2. Создай тэг: `git tag -a v0.2.0-phase1 -m "Phase 1 complete: rich block editor, S3, Kinescope, progress tracking, publishing"`.
3. Push на GitHub и GitFlic.
4. Сообщи Paul: **«Phase 1 закрыт. Платформа готова для пилотного курса RunStart. Дай знать, когда хочешь запустить Phase 2 (тесты и задания) — или сначала залить туда реальный курс школы бега.»**

## Что Phase 1 НЕ покрывает (это нормально)

Эти штуки сознательно отложены — НЕ добавляй их в этой фазе:

- Тесты с автопроверкой (Phase 2).
- Задания с загрузкой файлов от учеников (Phase 2).
- Импорт из Moodle `.mbz` (Phase 3).
- Полноценная аналитика и дашборды (Phase 4).
- Комментарии и сообщения (Phase 4).
- Родительский кабинет (Phase 4 или совмещённо с 6).
- AI-фичи (Phase 5).
- ЕСИА (Phase 6).
- Биллинг (Phase 7).

Если Paul просит добавить что-то из этого списка прямо сейчас — НЕ соглашайся, скажи: «Это в Phase 2, давай закроем Phase 1 чисто и потом возьмёмся за следующее».

---

## Если что-то пошло сильно не так

- `git restore .` — откатить незакоммиченные изменения.
- `git reset --hard HEAD~1` — откатить последний коммит.
- `pnpm --filter @parta5/db exec prisma migrate reset --force` — сбросить БД (только локально).
- `docker compose down -v && docker compose up -d` — полный ресет инфры.
- Не уверен — спроси Paul, не выдумывай.

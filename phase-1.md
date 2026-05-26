# Phase 1 — MVP контент + видео (self-hosted)

> Исполнительный сценарий для Claude Code. Прочитай этот файл целиком, прочитай `CLAUDE.md`, проверь, что Phase 0 закрыт (`git tag --list "v0.1.0-phase0"`), потом выполняй шаги строго по порядку.

**Цель фазы:** превратить скелет из Phase 0 в полноценный редактор курсов, в котором учитель собирает урок из разных типов блоков (текст, заголовки, изображения, видео, файлы, выноски, код), грузит файлы в S3, **хостит видео полностью у себя через FFmpeg+HLS** или вставляет embed из любого внешнего сервиса (YouTube/RuTube/VK/Kinescope/Vimeo), а ученик проходит курс с трекингом прогресса на уровне блоков и сохранением xAPI-like событий.

**Философия:** Парта5 — это «как Moodle, но современно». Школа ставит `docker compose up` на своём сервере и работает автономно. Никаких обязательных внешних SaaS, никаких «утекут данные». Видео хостится локально, транскодируется локально, стримится локально. Embed внешних — опция для тех, кому проще.

**После завершения** Paul должен иметь возможность собрать на платформе реальный курс школы бега RunStart как первый пилотный курс — с видео полностью на собственной инфре.

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

## Архитектурное решение: видео

Принято в этой фазе, фиксируется в ADR-003 (создаётся в шаге 4):

- **Self-hosted HLS — дефолт.** mp4/webm от учителя → MinIO/S3 → `apps/worker` через BullMQ берёт задачу → FFmpeg транскодирует в HLS (360p / 720p / 1080p, master.m3u8 + сегменты) → результат обратно в S3 → клиент стримит через HLS.js плеер.
- **Универсальный embed** — параллельный путь. Учитель вставляет URL, провайдер детектится автоматически (YouTube / RuTube / VK Видео / Kinescope / Vimeo / Boomstream / Дзен), показываем их iframe.
- **Адаптеры коммерческих SaaS** (Kinescope/Boomstream/PlatformCraft/Yandex Cloud Stream) — НЕ в Phase 1. Закладываем только `VideoAdapter` интерфейс, реализации появятся как опциональные модули в Phase 4-7. В ядре их нет.

Это значит:

- Никакого `parta5/kinescope/api-token` в Bitwarden.
- В docker-compose добавляется новый сервис `worker` с FFmpeg.
- Появляется `apps/worker` в монорепо.
- Появляется `packages/video` с интерфейсом и двумя реализациями (SelfHostedHLS, ExternalEmbed).

---

## Секреты через Bitwarden

| Item в Bitwarden                      | Где используется | Как получить                                            |
| ------------------------------------- | ---------------- | ------------------------------------------------------- |
| `parta5/s3/minio-local-root-user`     | Локальный MinIO  | Сгенерируй (например `parta5admin`), положи в Bitwarden |
| `parta5/s3/minio-local-root-password` | Локальный MinIO  | `openssl rand -hex 24`, положи в Bitwarden              |
| `parta5/s3/bucket-name`               | Имя бакета       | По умолчанию `parta5-uploads`                           |

Никаких внешних API-токенов для видео в этой фазе не нужно. Embed-блоки работают без API — просто iframe по URL.

---

## Чек-лист

- [x] Шаг 1 — расширить модель `ContentBlock` (12 типов блоков) + миграция
- [x] Шаг 2 — S3-хранилище: MinIO в docker-compose + `@parta5/storage` пакет
- [ ] Шаг 3 — загрузка файлов: `FileAsset` модель + presigned URLs + UI-компонент
- [ ] Шаг 4 — `apps/worker` + FFmpeg + HLS-транскодинг + `@parta5/video` с двумя адаптерами
- [ ] Шаг 5 — блочный редактор Notion-style с TipTap и `dnd-kit`
- [ ] Шаг 6 — расширенные метаданные курса: cover, предмет, класс, rich-text описание
- [ ] Шаг 7 — трекинг прогресса на уровне блоков (`BlockView` + IntersectionObserver + HLS.js events)
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
     VIDEO          // self-hosted, data: { videoAssetId: uuid }
     VIDEO_EMBED    // внешний провайдер, data: { provider: string, url: string, embedUrl: string, providerVideoId?: string }
     FILE           // data: { fileAssetId: uuid, displayName: string }
     CALLOUT        // data: { variant: 'info'|'warning'|'success'|'danger', text: string }
     CODE           // data: { language: string, code: string }
     QUOTE          // data: { text: string, author?: string }
     DIVIDER        // data: {}
     EMBED_IFRAME   // generic iframe, data: { url: string, height: number } — для admin only
   }
   ```
2. Удали старые семена TEXT-блоков, которые не подходят под новую структуру. Перепиши сид: используй HEADING + TEXT + DIVIDER.
3. Не добавляй модели `FileAsset` и `VideoAsset` — они появятся в шагах 3 и 4. Сейчас в `data` будут лежать только текстовые типы блоков; uuid'ы добавим миграциями в нужных шагах.
4. Создай миграцию: `prisma migrate dev --name expand_content_block_types`.
5. Обнови tRPC роутер `block.ts`:
   - `create({lessonId, type, data})` — `data` валидируй через zod discriminated union по `type`. Все 12 вариантов schemas в отдельном файле `apps/web/server/schemas/block-data.ts`.
   - `update({id, data})` — аналогичная валидация.
   - `reorder({lessonId, blockIds: string[]})` — атомарно переставляет order.
6. Для типов `VIDEO` и `IMAGE` и `FILE`, ссылающихся на ассеты — на этом шаге достаточно валидировать структуру (uuid поле). Существование ассета будем проверять в шагах 3/4.

**Проверка:**

```bash
pnpm --filter @parta5/db exec prisma migrate dev
pnpm --filter @parta5/db exec prisma db seed
pnpm --filter web typecheck

# Через Prisma Studio руками создай блок type=CALLOUT, data={variant:'info',text:'Привет'} — должен сохраниться.
pnpm --filter @parta5/db exec prisma studio
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
       getObjectStream(key: string): Promise<NodeJS.ReadableStream>; // для воркера, чтобы стримить файл в FFmpeg
       putObjectFromPath(key: string, localPath: string, contentType: string): Promise<void>; // для воркера, выгрузка HLS-сегментов
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

**Цель:** учитель загружает изображения и файлы (PDF, doc, zip) через браузер прямо в S3 по presigned URL, минуя сервер. Видео — отдельная история в шаге 4.

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
   - `requestUpload({originalName, mimeType, sizeBytes})` → создаёт `FileAsset` в статусе PENDING, возвращает `{fileAssetId, uploadUrl, key, expiresAt}`. Серверная валидация: размер ≤ 50 MB для изображений/файлов. MIME-whitelist для этого роутера (`image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `application/zip`, `application/msword`, `application/vnd.openxmlformats-*`). Видео сюда **не** пускаем — для них отдельный путь в шаге 4.
   - `confirmUpload({fileAssetId})` → вызывает `storage.headObject(key)`, если файл реально загружен — статус UPLOADED. Если нет — возвращает ошибку.
   - `delete({fileAssetId})` → soft delete (статус DELETED) + `storage.delete(key)`.
3. UI-компонент `apps/web/components/file-upload.tsx` (client component):
   - Props: `accept` (MIME маска), `maxSizeMB`, `onUploaded(fileAsset)`.
   - Использует `fetch(uploadUrl, { method: 'PUT', body: file })` с прогресс-баром через `XMLHttpRequest` (fetch не даёт upload progress).
   - После завершения — вызывает `confirmUpload`, потом колбэк.
4. Интеграция в редактор курсов (Phase 0 версия редактора — заглушка, полноценный будет в шаге 5): блок IMAGE и FILE открывают `FileUpload` модалку. После загрузки в `block.data` пишется `{fileAssetId, originalName, mimeType}`.
5. Helper `apps/web/lib/file-url.ts` — `getFileUrl(asset: FileAsset): string` возвращает `storage.publicUrl(asset.key)` (на сервере) или прокси-роут (для приватных файлов — пока не делаем, все uploaded = публичные).

**Проверка:**

Ручная:

1. Открой `/courses/[id]/edit`.
2. Добавь блок IMAGE → загрузи PNG → должен появиться в редакторе.
3. Сделай рефреш — картинка осталась.

```bash
pnpm --filter web typecheck
pnpm --filter web test
```

**Коммит:**

```
feat(files): add FileAsset model and browser uploads via presigned URLs
```

---

## Шаг 4 — `apps/worker` + FFmpeg + HLS-транскодинг + `@parta5/video`

**Цель:** self-hosted видео из коробки. Учитель загружает mp4 → BullMQ-воркер с FFmpeg делает HLS → ученик смотрит через адаптивный плеер. Плюс универсальный embed-блок для тех, кто хочет YouTube/RuTube/VK.

**Это самый большой шаг в Phase 1.** Разбит на 4 под-шага. Коммить каждый отдельно — потом отметишь шаг 4 целиком.

### 4а — Архитектурное решение ADR-003

1. Создай `docs/architecture/0003-video-strategy.md` с описанием решения: self-hosted HLS как дефолт + универсальный embed. Альтернативы (только embed; PeerTube; MediaCMS; адаптеры SaaS) рассмотрены и отклонены — кратко обоснуй.
2. Коммит: `docs(architecture): ADR-003 video strategy (self-hosted HLS + embed)`.

### 4б — Модель данных и пакет `@parta5/video`

1. В Prisma schema добавь:
   ```prisma
   model VideoAsset {
     id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId        String   @db.Uuid
     uploaderId     String   @db.Uuid
     sourceKey       String   @unique               // оригинальный mp4 в S3
     hlsMasterKey    String?                        // ключ master.m3u8 после транскодинга
     posterKey       String?                        // постер (jpg первого кадра)
     durationSeconds Int?
     width           Int?
     height          Int?
     status          VideoAssetStatus @default(PENDING)  // PENDING → UPLOADING → TRANSCODING → READY → FAILED
     errorMessage    String?
     createdAt       DateTime @default(now())
     uploader        User     @relation(fields: [uploaderId], references: [id])
     @@index([schoolId])
     @@index([status])
   }
   enum VideoAssetStatus { PENDING UPLOADING TRANSCODING READY FAILED }
   ```
   Миграция.
2. Создай пакет `packages/video`:
   - `package.json` name `@parta5/video`, dep `zod`, peer `@parta5/storage`.
   - `src/index.ts` — экспорт `VideoAdapter` интерфейса:
     ```ts
     export type VideoStatus = 'pending' | 'uploading' | 'transcoding' | 'ready' | 'failed';
     export interface VideoAdapter {
       requestUpload(input: {
         schoolId: string;
         originalName: string;
         sizeBytes: number;
         uploaderId: string;
       }): Promise<{ videoAssetId: string; uploadUrl: string; key: string; expiresAt: Date }>;
       confirmUploaded(videoAssetId: string): Promise<void>;
       getStatus(videoAssetId: string): Promise<{
         status: VideoStatus;
         hlsPlaylistUrl?: string;
         posterUrl?: string;
         durationSeconds?: number;
       }>;
       delete(videoAssetId: string): Promise<void>;
     }
     ```
   - `src/self-hosted.ts` — `SelfHostedHLSVideoAdapter` (использует `StorageAdapter` + `Queue` из `bullmq`):
     - `requestUpload` создаёт `VideoAsset` (status PENDING), presign upload URL для S3, возвращает.
     - `confirmUploaded` ставит status UPLOADING, кладёт job `transcode-video` в очередь `video-transcode`, возвращает.
     - `getStatus` читает из БД.
     - `delete` удаляет S3-объекты (source + HLS + poster) и помечает status FAILED → удаляет запись.
   - `src/embed/index.ts` — `parseEmbedUrl(url: string): {provider: string; embedUrl: string; videoId?: string} | null` — детект провайдеров:
     - YouTube: `youtube.com/watch?v=ID`, `youtu.be/ID` → `youtube.com/embed/ID`.
     - RuTube: `rutube.ru/video/ID/` → `rutube.ru/play/embed/ID`.
     - VK Видео: `vk.com/video-OWNER_ID`, `vkvideo.ru/video-OWNER_ID` → `vk.com/video_ext.php?oid=...&id=...`.
     - Kinescope: `kinescope.io/ID` → `kinescope.io/embed/ID`.
     - Vimeo: `vimeo.com/ID` → `player.vimeo.com/video/ID`.
     - Boomstream: `play.boomstream.com/CODE` → `play.boomstream.com/CODE?embed=1`.
     - Дзен: `dzen.ru/video/watch/ID` → embed URL по их доке.
     - Все паттерны вынеси в `src/embed/providers.ts` массив `{provider, urlPattern: RegExp, buildEmbedUrl: (match) => string}`.
   - Никаких HTTP-запросов в `parseEmbedUrl` — только парсинг URL. Это важно для производительности и оффлайн-теста.
3. Юнит-тесты на `parseEmbedUrl` для каждого провайдера — Vitest. Покрытие 100%.

### 4в — `apps/worker` процесс с FFmpeg

1. Создай новое приложение `apps/worker` в монорепо:
   - `apps/worker/package.json` — name `@parta5/worker`, deps: `bullmq`, `ioredis`, `@parta5/db`, `@parta5/storage`, `@parta5/video`, `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`, `pino`, `pino-pretty` (dev).
   - `apps/worker/src/index.ts` — точка входа. Подключает Redis (`REDIS_URL` из env), создаёт `Worker` для очереди `video-transcode`.
   - `apps/worker/src/jobs/transcode-video.ts` — обработчик:
     1. Получает `{videoAssetId}` из job.
     2. Читает `VideoAsset` из БД.
     3. Обновляет status на `TRANSCODING`.
     4. Скачивает source mp4 из S3 в tmp-папку (`fs.mkdtemp`).
     5. `ffprobe` — получает duration, width, height. Записывает в БД.
     6. Генерирует poster (`ffmpeg -i source.mp4 -vframes 1 -an poster.jpg`). Загружает в S3 (`schools/{schoolId}/posters/{videoAssetId}.jpg`).
     7. Транскодирует в HLS три варианта (360p, 720p, 1080p) одним FFmpeg-вызовом через `-var_stream_map`. Создаёт `master.m3u8` со всеми вариантами.
     8. Загружает все `.m3u8` и `.ts` сегменты в S3 (`schools/{schoolId}/hls/{videoAssetId}/...`).
     9. Обновляет `VideoAsset`: `status = READY`, `hlsMasterKey`, `posterKey`, `durationSeconds`, `width`, `height`.
     10. Если на любом шаге ошибка — `status = FAILED`, `errorMessage`. **Без retry** — повторно загружать видео учитель будет руками (в Phase 1 ОК).
     11. Чистит tmp-папку.
   - `apps/worker/Dockerfile` — multi-stage: ставит FFmpeg через `apt-get install ffmpeg` (нужно для production) или через `@ffmpeg-installer/ffmpeg` (для dev — но для production это слишком хрупко, в production через apt).
2. В `docker-compose.yml` добавь сервис `worker`:
   ```yaml
   worker:
     build:
       context: .
       dockerfile: apps/worker/Dockerfile
     environment:
       DATABASE_URL: ${DATABASE_URL}
       REDIS_URL: redis://redis:6379
       S3_*: (как у web)
     depends_on: [postgres, redis, minio]
   ```
3. Worker должен запускаться в локальной разработке через `pnpm --filter @parta5/worker dev` (использует `tsx watch`).

### 4г — Интеграция в `apps/web`

1. tRPC роутер `video.ts`:
   - `requestUpload({originalName, sizeBytes})` → `videoAdapter.requestUpload(...)` + возвращает `{videoAssetId, uploadUrl, expiresAt}`. Лимит: ≤ 1 GB и mp4/webm/mov только.
   - `confirmUploaded({videoAssetId})` → `videoAdapter.confirmUploaded(...)` (ставит в очередь транскодинга).
   - `getVideo({videoAssetId})` → `videoAdapter.getStatus(...)`.
   - `delete({videoAssetId})` → `videoAdapter.delete(...)`.
   - Все вызовы — внутри `withTenant(schoolId, ...)`.
2. tRPC роутер `embed.ts`:
   - `parseUrl({url})` → возвращает `parseEmbedUrl(url)` из `@parta5/video`. Server side — потому что регэкспы потом будем дополнять без редеплоя фронта.
3. UI-компонент `apps/web/components/video-uploader.tsx` (client):
   - Drag-and-drop mp4 → `requestUpload` → upload через XMLHttpRequest с прогресс-баром → `confirmUploaded`.
   - Опрос статуса каждые 5 сек через `getVideo`, пока не READY/FAILED. Прогресс-индикатор в три стадии: загрузка / транскодинг / готово.
4. UI-компонент `apps/web/components/hls-player.tsx` (client):
   - Зависимость: `hls.js`.
   - Props: `videoAssetId`, `onTimeUpdate({currentTime, duration})`, `onEnded()`.
   - Получает `hlsPlaylistUrl` из `getVideo`, инициализирует HLS.js, рендерит `<video>` с poster. На Safari — нативный HLS без hls.js.
5. UI-компонент `apps/web/components/embed-player.tsx` (client):
   - Props: `provider`, `embedUrl`.
   - Рендерит `<iframe>` с правильными `allow`-атрибутами (autoplay; encrypted-media; picture-in-picture).
6. Заглушки в редакторе курсов (полноценный редактор будет в шаге 5):
   - Блок `VIDEO` — кнопка «Загрузить видео» → `<VideoUploader>` → после READY сохраняется в `block.data = { videoAssetId }`.
   - Блок `VIDEO_EMBED` — текстовое поле с URL → `embed.parseUrl` → сохраняется `{ provider, url, embedUrl }`. Превью embed под полем.

**Проверка шага 4:**

```bash
# Поднять весь стек локально
docker compose up -d postgres redis minio minio-init worker
sleep 5
docker compose logs worker | tail -10   # должен висеть, ждать jobs

pnpm --filter @parta5/db exec prisma migrate dev
pnpm --filter @parta5/video test         # все embed-провайдеры пройдены

pnpm --filter web dev &
sleep 5

# Ручная проверка:
# 1. Логин как учитель.
# 2. Создай блок VIDEO, загрузи короткий mp4 (10-30 сек).
# 3. В Prisma Studio проверь VideoAsset — status проходит PENDING → UPLOADING → TRANSCODING → READY.
# 4. В MinIO Console (http://localhost:9001) проверь, что появились файлы в schools/.../hls/.../master.m3u8.
# 5. Открой урок как ученик — HLS-плеер играет видео.
# 6. Создай блок VIDEO_EMBED, вставь URL с YouTube или RuTube — embed работает.
```

**Финальный коммит шага 4 (после 4а-4г):**

```
feat(video): self-hosted HLS transcoding worker and universal embed adapter
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
     - `ImageBlock` (картинка + alt + caption через `<FileUpload>`)
     - `VideoBlock` (self-hosted, через `<VideoUploader>` + `<HlsPlayer>`)
     - `VideoEmbedBlock` (поле URL → детект провайдера → `<EmbedPlayer>`)
     - `FileBlock` (загрузка + display name)
     - `CalloutBlock` (variant select + text)
     - `CodeBlock` (language select + textarea с моноширинным шрифтом, без подсветки в Phase 1)
     - `QuoteBlock`
     - `DividerBlock` (просто `<hr>`)
3. Автосохранение: каждый блок при изменении вызывает `trpc.block.update` с debounce 500 ms. Индикатор «Сохранено» / «Сохраняется...» в углу страницы.
4. Drag-and-drop: при отпускании — `trpc.block.reorder({lessonId, blockIds})`. Оптимистично обновлять локальный state.
5. Слэш-меню `<BlockTypeMenu>`: 12 типов блоков с иконками и описаниями. Поиск по названию (фильтр). Кнопка Enter — выбрать.
6. Поведение клавиатуры:
   - Backspace в начале пустого блока → удалить блок и переместить фокус в предыдущий.
   - Enter в TEXT блоке → создать новый TEXT блок снизу.
   - Cmd/Ctrl+Z → undo (TipTap встроенный, для остального — пока без undo).
7. Замени старую страницу `/courses/[id]/edit` правую панель на `<BlockEditor>`.

**Проверка:**

Ручная:

1. Открой `/courses/[id]/edit/[lessonId]`.
2. Добавь блоки разных типов через «/» меню.
3. Перетащи блок drag-and-drop.
4. Отредактируй текст — через 500 ms видишь «Сохранено».
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
   subject          String?           // school subject: 'biology', 'math', 'russian'...
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
3. Страница `/courses/[id]/edit/settings` — форма настроек курса: title, slug (с валидацией уникальности), subject (select), gradeLevel (select 5-11), shortDescription (input), longDescription (TipTap), coverFileAsset (`<FileUpload>`).
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
     - Для VIDEO (self-hosted, HLS.js): подписка на `timeupdate` каждые 5 сек обновляет watchedSeconds, при 90% просмотра → `markBlockCompleted`.
     - Для VIDEO_EMBED: 1) YouTube — через YouTube iframe API можно ловить прогресс, 2) RuTube/VK/прочие iframe — без точного прогресса, считаем completed по клику «Я посмотрел» под плеером.
     - Для остальных типов (TEXT, IMAGE, etc) — viewed = completed автоматически или по нажатию «Прочитано» внизу урока.
4. Боковая панель прогресса на `/learn/[courseId]`:
   - Список уроков с прогресс-баром (`3/5 блоков`).
   - Общий прогресс по курсу (`78%`).
5. Обнови `LessonCompletion` из Phase 0: теперь считаем урок завершённым, если все блоки в нём completed (или 90% — настраиваемо). Триггер при `markBlockCompleted` → пересчитать `LessonCompletion`.

**Проверка:**

Ручная:

1. Открой урок как ученик.
2. Поскролль до конца — все TEXT/IMAGE блоки помечены viewed (в Prisma Studio проверь BlockView).
3. Посмотри self-hosted видео целиком — `watchedSeconds` растёт, в конце completedAt установлен.
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

# Проверь индексы — для timestamp DESC должны создаться правильно
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
   - Разные типы блоков в уроках: HEADING, TEXT (с rich content), IMAGE (placeholder fileAsset), VIDEO_EMBED (ссылка на короткий ролик с RuTube — потому что RuTube embed работает без CDN-ключей), CALLOUT (совет), DIVIDER.
   - Курс в статусе PUBLISHED, с обложкой, описанием, subject = 'pe' (физкультура).
   - Запиши студента на курс.
2. Зависимости в корне: `pnpm add -Dw @playwright/test`. Установи браузеры: `npx playwright install --with-deps chromium`.
3. `playwright.config.ts` в корне.
4. `e2e/` директория в корне с тестами:
   - `e2e/auth.spec.ts` — signup создаёт школу, логин работает.
   - `e2e/course-creation.spec.ts` — учитель создаёт курс, добавляет модуль, урок, разные типы блоков (НЕ загружает реальное видео — это slow и flaky в CI; вместо этого использует embed-блок с фейк-URL), публикует.
   - `e2e/student-journey.spec.ts` — ученик записан → видит курс → проходит уроки → прогресс растёт → курс на 100%.
   - `e2e/video-upload.spec.ts` — отдельный «slow» тест, только локально (skip в CI): загружает реальный 5-секундный mp4, ждёт READY, проверяет что появился HLS-плеер.
5. CI workflow (`.github/workflows/ci.yml`) — добавь job `e2e`:
   - services: postgres, redis, minio.
   - **Без worker** в e2e — видео тесты skip'аются в CI.
   - Шаги: prisma migrate, prisma seed, build, `playwright test --grep-invert=@slow`.
   - Артефакты: screenshots/videos failed тестов.
6. Обнови `README.md`:
   - Скриншоты редактора и просмотра ученика.
   - Раздел «Demo» — `docker compose up`, `/login` с `admin@school1.test` / `password`.
   - Раздел «Что умеет MVP» с маркированным списком фич Phase 0+1.
   - Раздел «Видео в Парта5» — кратко объяснить, что есть две опции: self-hosted HLS из коробки и универсальный embed.
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

# e2e локально (без slow)
pnpm exec playwright test --grep-invert=@slow --reporter=list

# опционально — полный e2e с видео (нужен worker)
docker compose up -d worker
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
2. Создай тэг: `git tag -a v0.2.0-phase1 -m "Phase 1 complete: rich block editor, S3, self-hosted HLS video, progress tracking, publishing"`.
3. Push на GitHub и GitFlic.
4. Сообщи Paul: **«Phase 1 закрыт. Платформа готова для пилотного курса RunStart с собственным видео-хостингом. Дай знать, когда хочешь запустить Phase 2 (тесты и задания) — или сначала залить туда реальный курс школы бега.»**

## Что Phase 1 НЕ покрывает (это нормально)

Эти штуки сознательно отложены — НЕ добавляй их в этой фазе:

- Тесты с автопроверкой (Phase 2).
- Задания с загрузкой файлов от учеников (Phase 2).
- Импорт из Moodle `.mbz` (Phase 3).
- Полноценная аналитика и дашборды (Phase 4).
- Комментарии и сообщения (Phase 4).
- Родительский кабинет (Phase 4 или совмещённо с 6).
- AI-фичи (Phase 5).
- Адаптеры для Kinescope / Boomstream / Yandex Stream / PlatformCraft — опциональные модули в Phase 4-7.
- DRM, watermarking, защита видео от скачивания (опциональные модули).
- CDN для HLS-сегментов — для масштаба, в Phase 1 хватает прямой раздачи из MinIO.
- Live-стриминг (вероятно никогда — это отдельная категория продукта).
- ЕСИА (Phase 6).
- Биллинг (Phase 7).

Если Paul просит добавить что-то из этого списка прямо сейчас — НЕ соглашайся, скажи: «Это в следующей фазе, давай закроем Phase 1 чисто и потом возьмёмся за следующее».

---

## Если что-то пошло сильно не так

- `git restore .` — откатить незакоммиченные изменения.
- `git reset --hard HEAD~1` — откатить последний коммит.
- `pnpm --filter @parta5/db exec prisma migrate reset --force` — сбросить БД (только локально).
- `docker compose down -v && docker compose up -d` — полный ресет инфры.
- Не уверен — спроси Paul, не выдумывай.

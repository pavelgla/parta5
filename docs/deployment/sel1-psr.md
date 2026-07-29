# Деплой пилотного инстанса ПСР на sel1 (psr.parta5.ru)

Гайд для человека с ssh-доступом к серверу sel1 (Ubuntu, Docker, IP `31.184.215.86`).
Деплоит один self-host стек Парта5 для пилота с контентом Moodle учебного центра
«ПрофСпецРесурс» (106 курсов, десятки тысяч вопросов с картинками, ~773 PDF).

Файлы стека: `docker-compose.prod.yml`, `Caddyfile`, `.env.production.example` (корень
репозитория). Дев-стек (`docker-compose.yml`) для локальной разработки этим не
затрагивается — на sel1 он не используется.

---

## 1. Предпосылки

- **DNS.** A-запись `psr.parta5.ru → 31.184.215.86` должна быть создана и уже
  разрезолвиться (`dig +short psr.parta5.ru` возвращает нужный IP) **до** первого
  запуска Caddy — иначе выпуск сертификата Let's Encrypt (HTTP-01 challenge) не
  пройдёт и Caddy будет ретраить с задержкой.
- **Порты.** 80 и 443 открыты на сервере (файрвол/security group), ничем не заняты
  (`sudo ss -ltnp | grep -E ':80|:443'` — пусто).
- **Docker.** Установлены Docker Engine и плагин Compose v2:
  ```bash
  docker --version          # Docker version 24+ или новее
  docker compose version    # Docker Compose version v2.x
  ```
- **Диск.** См. раздел 8 — расчёт под 106 курсов ПСР с картинками и PDF.
- **git** для клонирования репозитория.

## 2. Клонирование, `.env`, секреты

```bash
cd /opt   # или любая рабочая директория для self-host стеков
git clone <URL репозитория parta5> parta5
cd parta5

cp .env.production.example .env
chmod 600 .env
```

Заполни `.env`, сгенерировав реальные значения вместо `CHANGE_ME_*`:

```bash
# AUTH_SECRET — секрет подписи JWT-сессий Auth.js
openssl rand -base64 32

# Пароли Postgres/MinIO — можно тем же способом, или:
openssl rand -hex 24
```

Обязательно проверь/поправь в `.env`:

- `SITE_DOMAIN=psr.parta5.ru` — должен совпадать с DNS-записью из шага 1.
- `ACME_EMAIL` — реальный email, который кто-то реально читает (уведомления
  Let's Encrypt об истечении сертификата).
- `AUTH_URL=https://psr.parta5.ru` — **побайтово** совпадает со схемой и доменом,
  на который реально ходят пользователи (см. «Грабли», п. 2).
- `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD` — разные пароли для роли-владельца
  схемы (`parta5`) и рантайм-роли (`parta5_app`), см. ADR-002.
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` — пароль ≥ 8 символов (требование MinIO).

`.env` не должен попасть в git — он уже в `.gitignore` репозитория, перепроверь
`git status` перед любым коммитом из этой директории.

## 3. Первый запуск

Сборка образов (может занять несколько минут — сборка `web` компилирует Next.js,
`worker` устанавливает ffmpeg):

```bash
docker compose -f docker-compose.prod.yml --env-file .env build
```

Поднять только БД (нужна для миграций), дождаться healthy:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d db
docker compose -f docker-compose.prod.yml --env-file .env ps db   # ждём "healthy"
```

Применить миграции схемой-владельцем (сервис `migrate` не входит в стек по
умолчанию — только явный запуск через `--profile migrate`):

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile migrate run --rm migrate
```

Поднять весь стек:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
docker compose -f docker-compose.prod.yml --env-file .env ps   # все сервисы "healthy"/"running"
```

**Создание первой школы и админа.** Отдельного seed-скрипта для прод-данных нет и
не нужен — школа и первый администратор создаются через обычную регистрацию в
браузере:

1. Открой `https://psr.parta5.ru/signup`.
2. Заполни название школы («ПрофСпецРесурс» или как договорено), email и пароль
   администратора.
3. После отправки формы — автоматический вход и редирект в `/courses`.

Дальше пользователей (преподавателей, слушателей, группы) заводит уже сам админ
через `/admin/users` (этап S4/S5, см. `docs/STAGE-D-SPEC.md`).

## 4. Проверка живости

- `https://psr.parta5.ru/login` — открывается, сертификат валиден (замок в браузере,
  не self-signed).
- `docker compose -f docker-compose.prod.yml --env-file .env ps` — `web`, `db`,
  `redis`, `minio`, `worker`, `caddy` в состоянии `running`/`healthy`.
- `docker compose -f docker-compose.prod.yml --env-file .env logs caddy --tail=50` —
  нет ошибок выпуска сертификата (`certificate obtained successfully` в логе caddy).
- Вход под созданным на шаге 3 админом, переход в `/courses` — пустой список курсов
  (до импорта C7) без ошибок 500.

## 5. Бэкапы

### PostgreSQL

Дамп через `pg_dump` внутри контейнера `db` (роль-владелец `parta5`, доступ к БД
только из docker-сети — наружу порт не пробрасывается):

```bash
mkdir -p /opt/parta5-backups/pg
docker compose -f docker-compose.prod.yml --env-file .env exec -T db \
  pg_dump -U parta5 -d parta5 | gzip > /opt/parta5-backups/pg/parta5-$(date +%F).sql.gz
```

Cron (ежедневно в 3:00, хранить 14 дней):

```cron
0 3 * * * cd /opt/parta5 && docker compose -f docker-compose.prod.yml --env-file .env exec -T db pg_dump -U parta5 -d parta5 | gzip > /opt/parta5-backups/pg/parta5-$(date +\%F).sql.gz && find /opt/parta5-backups/pg -name '*.sql.gz' -mtime +14 -delete
```

**Восстановление (проверяемая команда)** — сначала в тестовую БД, не поверх прод:

```bash
# 1. Создать пустую тестовую БД той же ролью-владельцем
docker compose -f docker-compose.prod.yml --env-file .env exec -T db \
  psql -U parta5 -d postgres -c "CREATE DATABASE parta5_restore_test OWNER parta5;"

# 2. Накатить дамп в неё
gunzip -c /opt/parta5-backups/pg/parta5-2026-07-29.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env exec -T db \
  psql -U parta5 -d parta5_restore_test

# 3. Проверить, что данные на месте
docker compose -f docker-compose.prod.yml --env-file .env exec -T db \
  psql -U parta5 -d parta5_restore_test -c "SELECT count(*) FROM \"Course\";"

# 4. Убрать тестовую БД
docker compose -f docker-compose.prod.yml --env-file .env exec -T db \
  psql -U parta5 -d postgres -c "DROP DATABASE parta5_restore_test;"
```

Реальное восстановление прод-БД (даунтайм, только при инциденте) — то же самое,
но `dropdb parta5` / `createdb parta5 -O parta5` перед накатыванием дампа, и
`migrate` может понадобиться перезапустить после, если восстанавливаемся на более
старую схему.

### MinIO (volume `miniodata`)

Файлы (картинки вопросов, PDF, обложки) лежат в именованном docker-volume
`parta5_miniodata`. Бэкапим тар-архивом через одноразовый контейнер (MinIO не
нужно останавливать — снапшот делается на живых файлах, для консистентности
достаточно, т.к. файлы в MinIO immutable после загрузки):

```bash
mkdir -p /opt/parta5-backups/minio
docker run --rm \
  -v parta5_miniodata:/data:ro \
  -v /opt/parta5-backups/minio:/backup \
  alpine tar czf /backup/miniodata-$(date +%F).tar.gz -C /data .
```

Cron (еженедельно, воскресенье в 4:00, хранить 4 недели — том большой, см. раздел 8):

```cron
0 4 * * 0 docker run --rm -v parta5_miniodata:/data:ro -v /opt/parta5-backups/minio:/backup alpine tar czf /backup/miniodata-$(date +\%F).tar.gz -C /data . && find /opt/parta5-backups/minio -name '*.tar.gz' -mtime +28 -delete
```

**Восстановление (проверяемая команда):**

```bash
docker compose -f docker-compose.prod.yml --env-file .env stop minio
docker run --rm \
  -v parta5_miniodata:/data \
  -v /opt/parta5-backups/minio:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/miniodata-2026-07-29.tar.gz -C /data"
docker compose -f docker-compose.prod.yml --env-file .env start minio
```

Оба бэкапа (`pg` и `minio`) стоит периодически копировать за пределы sel1 (другой
сервер/объектное хранилище) — локальный cron защищает от порчи данных, но не от
отказа диска/сервера целиком. Отдельная задача, не входит в этот гайд.

## 6. Обновление версии и откат

```bash
cd /opt/parta5
git fetch --tags
git checkout <новый тег или коммит>

docker compose -f docker-compose.prod.yml --env-file .env build web worker
docker compose -f docker-compose.prod.yml --env-file .env --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env up -d web worker
```

Перед обновлением, если миграция необратима (удаление колонки/таблицы) — сними
бэкап БД (раздел 5) заранее.

**Откат:**

```bash
git checkout <предыдущий тег>
docker compose -f docker-compose.prod.yml --env-file .env build web worker
docker compose -f docker-compose.prod.yml --env-file .env up -d web worker
```

Откат схемы БД (`prisma migrate deploy` необратим сам по себе, миграции вперёд не
откатываются командой из коробки) — только через восстановление бэкапа из раздела 5,
если новая миграция сломала данные. Планировать миграции так, чтобы это было
редкостью (аддитивные изменения, без разрушающих `DROP` в одном шаге с релизом).

## 7. Грабли

- **Порт БД наружу не публикуется.** `db`, `redis`, `minio` не имеют `ports:` в
  `docker-compose.prod.yml` — это прямое требование этапа A5 (мультитенантность
  через RLS защищает данные внутри БД, но только если к БД нельзя подключиться
  напрямую в обход приложения). Если нужен доступ для отладки (`psql`, `mc`) —
  заходи через `docker compose exec`, не пробрасывай порт на хост даже временно.
- **`AUTH_URL` обязан совпадать с реальным доменом.** Auth.js v5 сверяет Origin
  запроса с `AUTH_URL` при проверке CSRF/callback — расхождение (`http` вместо
  `https`, отсутствующий/лишний домен, слэш на конце) не даёт явной ошибки в UI,
  а просто молча отбрасывает вход (редирект обратно на `/login` без сообщения).
  Если логин не работает и в консоли браузера нет явных ошибок — первым делом
  сверь `AUTH_URL` в `.env` с адресной строкой браузера.
- **Импорт больших курсов идёт воркером и требует времени и места на диске.**
  Импорт `.mbz` — асинхронная job в BullMQ (`apps/worker`), не блокирует HTTP-запрос:
  UI покажет прогресс, но сам импорт (парсинг XML, заливка картинок в S3) может
  идти минуты на курс с тысячами вопросов. Смотреть прогресс:
  `docker compose -f docker-compose.prod.yml --env-file .env logs -f worker`.
  На время батч-импорта 106 курсов (этап C7) держи свободными минимум 30–40 ГБ
  сверх обычного — исходные `.mbz` временно распаковываются на диск воркера
  перед заливкой в S3.
- **HLS-видео и `S3_PUBLIC_URL`.** `S3_PUBLIC_URL` в этом стеке — внутренний адрес
  (`http://minio:9000/...`), потому что раздача картинок/PDF идёт через
  `/api/files/[id]` приложения (ADR-005), а не напрямую из MinIO — публиковать
  S3-эндпоинт наружу не нужно. НО self-hosted HLS-видео (`packages/video`) строит
  ссылки на плейлист/постер через тот же `storage.publicUrl()` и отдаёт их
  браузеру напрямую — с внутренним адресом это не будет работать (браузер
  пользователя не достучится до `minio:9000`). Для пилота ПСР это не блокер:
  контент — тесты с картинками, self-hosted видео не используется. Если видео
  понадобится — нужен либо проксирующий роут по образцу `/api/files/[id]`, либо
  публикация `public/*`-префикса бакета через отдельный Caddy-роут; ни то, ни
  другое не сделано в рамках этой задачи (S3), см. раздел «Приёмка» основного
  ответа.
- **`migrate` — не часть `docker compose up`.** Сервис вынесен в профиль
  `migrate` намеренно, чтобы миграции не гонялись повторно (и не спорили за
  блокировки) при каждом обычном рестарте стека. Запускать явно
  (`--profile migrate run --rm migrate`) после каждого обновления схемы.
- **MinIO требует пароль ≥ 8 символов** — при более коротком `MINIO_ROOT_PASSWORD`
  контейнер `minio` не стартует и падает в рестарт-луп; смотри
  `docker compose logs minio`, если сервис не выходит в healthy.
- **Первый запуск Caddy может занять до минуты** — выпуск сертификата ACME не
  мгновенный; `depends_on: web: condition: service_healthy` у Caddy это не
  ускоряет, а лишь гарантирует, что Caddy не начнёт проксировать до того, как
  `web` готов принимать запросы.

## 8. Оценка места на диске (грубая, честно приблизительная)

Расчёт по фактическим данным экспорта 4 курсов ПСР (`.local/c6/*.mbz`, снято
16.07.2026): 969 МБ на 4 курса → **≈ 242 МБ на курс** в исходном формате Moodle
`.mbz` (внутри уже архив, картинки/PDF занимают в нём основной объём).

Экстраполяция на 106 курсов (линейно, курсы неоднородны по объёму — это грубая
оценка, не точный расчёт):

| Компонент                                                    | Оценка     | Как посчитано                                                                                                                                                                                               |
| ------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Исходные `.mbz` (106 курсов)                                 | ≈ 26 ГБ    | 242 МБ × 106                                                                                                                                                                                                |
| Картинки/файлы после распаковки в MinIO                      | ≈ 20–25 ГБ | основной объём `.mbz` — это уже упомянутые файлы; после распаковки в S3 объём сопоставим (без пересжатия)                                                                                                   |
| ~773 PDF (упомянуты в исходных бэкапах ПСР)                  | ≈ 1.5–4 ГБ | ассумпция 2–5 МБ/PDF (методички/сканы) — **размер ни одного PDF не измерялся напрямую**, оценка может ощутимо разойтись с реальностью; частично уже входит в объём `.mbz` выше, не считать полностью поверх |
| Postgres (текст вопросов, структура курсов, ≈62.9k вопросов) | ≈ 1–2 ГБ   | текст+HTML вопроса в среднем несколько КБ, с индексами                                                                                                                                                      |
| Docker-образы (web/worker с ffmpeg/db/redis/minio/caddy)     | ≈ 3–4 ГБ   | типовой размер для стека такого состава                                                                                                                                                                     |
| Бэкапы (Postgres 14 дней + MinIO 4 недели)                   | ≈ 15–30 ГБ | `pg_dump` сжатый заметно меньше живой БД; MinIO-бэкап — полная копия тома на каждый снапшот, при 2–4 хранимых копиях набегает существенно                                                                   |
| ОС, логи, докер build-кэш, запас на импорт C7 (раздел 7)     | ≈ 15–20 ГБ |                                                                                                                                                                                                             |

**Итог: минимум 100 ГБ, комфортно — 150–200 ГБ SSD.** Это оценка «сверху и
честно», не точный расчёт — главная неопределённость в реальном среднем размере
PDF и в том, сколько поколений MinIO-бэкапа реально держать. Если диск сервера
меньше 100 ГБ — до батч-импорта (C7) стоит либо расширить том, либо сократить
глубину хранения бэкапов MinIO (например, 1 копия вместо 4).

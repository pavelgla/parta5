#!/usr/bin/env bash
#
# psr-export-batch.sh — батч-выгрузка курсов из боевого Moodle ПрофСпецРесурса (sel1).
#
# Задача C7 (docs/STAGE-D-SPEC.md): выгрузить все 106 курсов (mdl_course.id > 1) в .mbz
# для последующего импорта в «Парту5» скриптом scripts/psr-import-batch.sh.
#
# ЗАПУСКАТЬ ТОЛЬКО на sel1, там, где подняты контейнеры psr-moodle-1 / psr-mariadb-1
# (см. /opt/psr/docker-compose.yml). Скрипт сам себя перед стартом упрямо в этом
# проверяет и отказывается работать при отсутствии контейнеров.
#
# Скрипт НИЧЕГО не удаляет и не меняет в самом Moodle: он только запускает штатный
# CLI-бэкап (admin/cli/backup.php) и переносит готовые .mbz из временной директории
# moodledata в целевой каталог экспорта.
#
# Возобновляемость: если .mbz для курса уже лежит в целевом каталоге — курс пропускается.
# Поэтому скрипт можно прерывать (Ctrl+C, обрыв SSH-сессии) и перезапускать сколько угодно раз.
#
# Использование:
#   ./psr-export-batch.sh [опции]
#
# Опции:
#   --dest DIR            Каталог назначения для .mbz (по умолчанию: /opt/psr/c7-export)
#   --ids "2,3,5"          Явный список id курсов через запятую вместо выборки из БД
#   --ids-file FILE        Файл со списком id курсов (по одному в строке) вместо выборки из БД
#   --limit N              Обработать не более N курсов за этот запуск (по умолчанию: без лимита)
#   --min-free-gb N        Порог свободного места в ГБ, ниже которого скрипт останавливается
#                          (по умолчанию: 40)
#   --list-only            Только показать список курсов к выгрузке (id, имя, уже выгружен ли),
#                          ничего не запускать. Безопасный dry-режим для проверки.
#   --moodle-container NAME   Имя контейнера Moodle (по умолчанию: psr-moodle-1)
#   --db-container NAME       Имя контейнера MariaDB (по умолчанию: psr-mariadb-1)
#   --db-name NAME            Имя БД Moodle (по умолчанию: sdoprof)
#   --moodle-root DIR         Путь к корню Moodle внутри контейнера (по умолчанию: /var/www/html)
#   --moodle-data-host DIR    Путь на ХОСТЕ, примонтированный в /var/moodledata контейнера
#                             (по умолчанию: /opt/psr/private — см. docker-compose.yml на sel1)
#   --moodle-data-container DIR  Путь к moodledata ВНУТРИ контейнера (по умолчанию: /var/moodledata)
#   --tmp-subdir NAME         Имя временной поддиректории внутри moodledata для бэкапов
#                             (по умолчанию: temp/psr-export-batch)
#   --exec-user NAME          Пользователь ОС внутри контейнера, от имени которого запускать
#                             php (по умолчанию: www-data — как в примере в help backup.php)
#   --log FILE                Файл лога (по умолчанию: DEST/psr-export-batch.log)
#   -h, --help                Эта справка
#
# Проверено вручную на sel1 (2026-07-29, только чтением, см. отчёт задачи S7):
#   - admin/cli/backup.php лежит по пути /var/www/html/admin/cli/backup.php
#     внутри контейнера psr-moodle-1;
#   - /var/moodledata внутри контейнера смонтирован как bind-mount на хостовый
#     /opt/psr/private (см. docker inspect psr-moodle-1 --format '{{json .Mounts}}');
#   - /opt/psr/private/temp и его поддиректории имеют права 0777, владелец www-data —
#     запись туда из-под www-data и из-под root работает;
#   - mdl_course с id > 1 содержит ровно 106 строк, mdl_quiz — 2954, mdl_question — 62942
#     (проверено SELECT COUNT(*), сверяется со Stage D spec).
#
# Что НЕ проверено (см. также отчёт агента S7):
#   - Реальное время и итоговый объём выгрузки всех 106 курсов (оценка ниже — по 4 уже
#     выгруженным курсам из /opt/psr/c6-export, размер 76..441 МБ, среднее ~250 МБ).
#   - Поведение backup.php на самых больших курсах (нет данных, тестового прогона не было —
#     скрипт этой задачей запускать не требовалось).
#   - Есть ли у пользователя-администратора Moodle особые ограничения, влияющие на CLI-бэкап
#     (get_admin() в backup.php должен найти хоть одного админа — на боевом инстансе он есть,
#     но это не проверялось построчно).

set -euo pipefail

# ── Значения по умолчанию ────────────────────────────────────────────────────
DEST="/opt/psr/c7-export"
IDS=""
IDS_FILE=""
LIMIT=""
MIN_FREE_GB=40
LIST_ONLY=0
MOODLE_CONTAINER="psr-moodle-1"
DB_CONTAINER="psr-mariadb-1"
DB_NAME="sdoprof"
MOODLE_ROOT="/var/www/html"
MOODLE_DATA_HOST="/opt/psr/private"
MOODLE_DATA_CONTAINER="/var/moodledata"
TMP_SUBDIR="temp/psr-export-batch"
EXEC_USER="www-data"
LOG_FILE=""

usage() {
  # Печатает весь шапочный комментарий файла (между shebang и первой пустой
  # строкой перед кодом), не завязываясь на номера строк.
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
}

# ── Разбор аргументов ─────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --ids) IDS="$2"; shift 2 ;;
    --ids-file) IDS_FILE="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --min-free-gb) MIN_FREE_GB="$2"; shift 2 ;;
    --list-only) LIST_ONLY=1; shift ;;
    --moodle-container) MOODLE_CONTAINER="$2"; shift 2 ;;
    --db-container) DB_CONTAINER="$2"; shift 2 ;;
    --db-name) DB_NAME="$2"; shift 2 ;;
    --moodle-root) MOODLE_ROOT="$2"; shift 2 ;;
    --moodle-data-host) MOODLE_DATA_HOST="$2"; shift 2 ;;
    --moodle-data-container) MOODLE_DATA_CONTAINER="$2"; shift 2 ;;
    --tmp-subdir) TMP_SUBDIR="$2"; shift 2 ;;
    --exec-user) EXEC_USER="$2"; shift 2 ;;
    --log) LOG_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Неизвестный аргумент: $1" >&2; usage; exit 1 ;;
  esac
done

[ -n "$LOG_FILE" ] || LOG_FILE="$DEST/psr-export-batch.log"

log() {
  local msg
  msg="$(date '+%Y-%m-%d %H:%M:%S') $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

# ── Проверка окружения: мы точно на sel1, контейнеры PSR подняты ────────────
# Хостнейм sel1 в SSH-конфиге может не совпадать с реальным hostname машины,
# поэтому основная проверка — по факту наличия и работоспособности контейнеров,
# а не по имени хоста.
check_environment() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ОШИБКА: docker не найден. Похоже, это не sel1. Останавливаюсь." >&2
    exit 1
  fi

  for c in "$MOODLE_CONTAINER" "$DB_CONTAINER"; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || echo false)" != "true" ]; then
      echo "ОШИБКА: контейнер '$c' не найден или не запущен. Похоже, это не sel1" \
           "(или контейнеры PSR сейчас не подняты). Останавливаюсь." >&2
      exit 1
    fi
  done
}

# ── Свободное место на диске под DEST ────────────────────────────────────────
check_free_space() {
  local avail_kb avail_gb
  avail_kb="$(df -Pk -- "$DEST" | tail -1 | awk '{print $4}')"
  avail_gb=$(( avail_kb / 1024 / 1024 ))
  if [ "$avail_gb" -lt "$MIN_FREE_GB" ]; then
    log "ОСТАНОВКА: свободно ${avail_gb} ГБ на разделе '$DEST', порог --min-free-gb=${MIN_FREE_GB} ГБ."
    exit 1
  fi
}

# ── Список курсов из БД: "id<TAB>shortname" ──────────────────────────────────
fetch_courses_from_db() {
  docker exec "$DB_CONTAINER" sh -c \
    "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -N -e \
     'SELECT id, REPLACE(REPLACE(shortname, \"\\t\", \" \"), \"\\n\", \" \") FROM ${DB_NAME}.mdl_course WHERE id > 1 ORDER BY id;'"
}

# ── Построение списка курсов для обработки ──────────────────────────────────
# Пишет в глобальный массив COURSE_LINES строки "id<TAB>shortname"
declare -a COURSE_LINES=()

build_course_list() {
  if [ -n "$IDS" ] && [ -n "$IDS_FILE" ]; then
    echo "ОШИБКА: --ids и --ids-file взаимоисключающие." >&2
    exit 1
  fi

  if [ -n "$IDS" ] || [ -n "$IDS_FILE" ]; then
    local wanted=""
    if [ -n "$IDS" ]; then
      wanted="$(echo "$IDS" | tr ',' '\n' | tr -d ' ')"
    else
      wanted="$(grep -v '^\s*$' "$IDS_FILE")"
    fi
    # Имена подтягиваем из БД одним запросом и фильтруем по запрошенным id.
    local all_courses
    all_courses="$(fetch_courses_from_db)"
    while IFS= read -r id; do
      [ -n "$id" ] || continue
      local line
      line="$(echo "$all_courses" | awk -F'\t' -v id="$id" '$1 == id {print}')"
      if [ -z "$line" ]; then
        log "ПРЕДУПРЕЖДЕНИЕ: курс id=$id не найден в mdl_course, пропускаю."
        continue
      fi
      COURSE_LINES+=("$line")
    done <<< "$wanted"
  else
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      COURSE_LINES+=("$line")
    done <<< "$(fetch_courses_from_db)"
  fi

  if [ -n "$LIMIT" ]; then
    COURSE_LINES=("${COURSE_LINES[@]:0:$LIMIT}")
  fi
}

# ── Выгрузка одного курса ────────────────────────────────────────────────────
export_one_course() {
  local id="$1" shortname="$2"
  local existing
  existing="$(find "$DEST" -maxdepth 1 -name "backup-moodle2-course-${id}-*.mbz" 2>/dev/null | head -1)"
  if [ -n "$existing" ]; then
    log "ПРОПУСК id=$id ($shortname): уже выгружен -> $(basename "$existing")"
    return 0
  fi

  check_free_space

  local host_tmp_dir="$MOODLE_DATA_HOST/$TMP_SUBDIR"
  local container_tmp_dir="$MOODLE_DATA_CONTAINER/$TMP_SUBDIR"
  mkdir -p "$host_tmp_dir"

  local start_ts end_ts duration
  start_ts="$(date +%s)"
  log "СТАРТ id=$id ($shortname)"

  if docker exec -u "$EXEC_USER" "$MOODLE_CONTAINER" \
       php "$MOODLE_ROOT/admin/cli/backup.php" \
       --courseid="$id" --destination="$container_tmp_dir" \
       >> "$LOG_FILE" 2>&1; then
    :
  else
    end_ts="$(date +%s)"
    duration=$(( end_ts - start_ts ))
    log "ОШИБКА id=$id ($shortname): backup.php вернул ненулевой код, длительность ${duration}с"
    return 1
  fi

  end_ts="$(date +%s)"
  duration=$(( end_ts - start_ts ))

  local produced
  produced="$(find "$host_tmp_dir" -maxdepth 1 -name "backup-moodle2-course-${id}-*.mbz" 2>/dev/null | head -1)"
  if [ -z "$produced" ]; then
    log "ОШИБКА id=$id ($shortname): backup.php завершился, но .mbz не найден в $host_tmp_dir (длительность ${duration}с)"
    return 1
  fi

  local size_bytes size_mb
  size_bytes="$(stat -c '%s' "$produced")"
  size_mb=$(( size_bytes / 1024 / 1024 ))

  mv "$produced" "$DEST/"
  log "ГОТОВО id=$id ($shortname): $(basename "$produced"), ${size_mb} МБ, ${duration}с"
  return 0
}

# ── Main ──────────────────────────────────────────────────────────────────
main() {
  mkdir -p "$DEST"
  check_environment
  check_free_space
  build_course_list

  log "Курсов к обработке: ${#COURSE_LINES[@]} (DEST=$DEST, min-free-gb=$MIN_FREE_GB)"

  if [ "$LIST_ONLY" -eq 1 ]; then
    printf '%-8s %-10s %s\n' "ID" "СТАТУС" "НАЗВАНИЕ"
    for line in "${COURSE_LINES[@]}"; do
      id="$(echo "$line" | cut -f1)"
      shortname="$(echo "$line" | cut -f2-)"
      existing="$(find "$DEST" -maxdepth 1 -name "backup-moodle2-course-${id}-*.mbz" 2>/dev/null | head -1)"
      if [ -n "$existing" ]; then
        printf '%-8s %-10s %s\n' "$id" "готов" "$shortname"
      else
        printf '%-8s %-10s %s\n' "$id" "план" "$shortname"
      fi
    done
    exit 0
  fi

  local ok=0 skipped=0 failed=0
  for line in "${COURSE_LINES[@]}"; do
    id="$(echo "$line" | cut -f1)"
    shortname="$(echo "$line" | cut -f2-)"
    existing_before="$(find "$DEST" -maxdepth 1 -name "backup-moodle2-course-${id}-*.mbz" 2>/dev/null | head -1)"
    if export_one_course "$id" "$shortname"; then
      if [ -n "$existing_before" ]; then
        skipped=$((skipped + 1))
      else
        ok=$((ok + 1))
      fi
    else
      failed=$((failed + 1))
    fi
  done

  log "ИТОГО за прогон: успешно=${ok}, пропущено (уже было)=${skipped}, ошибок=${failed}"
}

main

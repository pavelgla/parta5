#!/usr/bin/env bash
#
# psr-import-batch.sh — батч-импорт выгруженных .mbz курсов ПрофСпецРесурса в «Парту5».
#
# Задача C7 (docs/STAGE-D-SPEC.md): взять .mbz-файлы, выгруженные scripts/psr-export-batch.sh,
# и прогнать их через штатный CLI-импортёр @parta5/importer (packages/importer/src/cli.ts).
#
# Ключевой режим — --dry-run: прогоняет ВСЕ файлы через импортёр в режиме dry-run (без записи
# в БД и без обращений к S3, см. DRY_RUN_STORAGE в cli.ts) и собирает сводный отчёт "что
# потеряем" ДО реального импорта. С него и предлагается начинать (см. docs/deployment/psr-migration.md).
#
# В обычном (не dry-run) режиме скрипт:
#   - идёт по .mbz в SRC_DIR по возрастанию id курса (извлекается из имени файла);
#   - ведёт файл состояния (--state-file) с уже успешно импортированными файлами и
#     пропускает их при повторном запуске — можно прерывать и перезапускать;
#   - при ошибке одного курса пишет её в отчёт и идёт дальше, не падая целиком;
#   - на выходе — CSV и Markdown отчёт о расхождениях: курс/статус/длительность/что
#     импортировано/что пропущено (сгруппировано по типам активностей и типам вопросов)/ошибка.
#
# Все количественные данные (модули, уроки, блоки, квизы, вопросы, пропуски) берутся из
# текстового отчёта, который печатает сам CLI импортёра (packages/importer/src/report-format.ts).
# Если в выводе нужной строки нет (например, импортёр упал раньше печати отчёта) — в CSV/MD
# ставится "н/д", числа не выдумываются.
#
# Использование:
#   ./psr-import-batch.sh --school <slug> --user <email> [опции]
#
# Обязательные параметры (кроме --dry-run без реального школьного контекста — см. ниже):
#   --school SLUG          Slug школы в «Парте5» (должна уже существовать — см. cli.ts:
#                          "Школа не найдена: slug=...")
#   --user EMAIL            Email пользователя-владельца импорта, принадлежащего этой школе
#
# Опции:
#   --src-dir DIR           Каталог с .mbz (по умолчанию: ./c7-export)
#   --dry-run               Прогнать все файлы в режиме dry-run импортёра, собрать только
#                          сводный отчёт "что потеряем", НЕ трогать файл состояния реального
#                          импорта и не создавать реальные курсы.
#   --state-file FILE       Файл состояния успешных реальных импортов
#                          (по умолчанию: SRC_DIR/.psr-import-state.tsv)
#   --report-dir DIR        Каталог для отчётов CSV/MD (по умолчанию: SRC_DIR/reports)
#   --report-name NAME      Базовое имя файлов отчёта без расширения
#                          (по умолчанию: psr-import-report, для --dry-run — psr-import-dryrun-report)
#   --limit N               Обработать не более N файлов за этот запуск
#   --repo-root DIR         Корень репозитория parta5 (по умолчанию: определяется через
#                          `git rev-parse --show-toplevel`, иначе — каталог на уровень выше
#                          scripts/). В режиме --runner docker это каталог, из которого
#                          запускается `docker compose` (там же должны лежать compose-файлы).
#   --pnpm-filter NAME      Имя пакета для `pnpm --filter` (по умолчанию: @parta5/importer,
#                          используется только при --runner pnpm)
#   --pnpm-script NAME      Имя npm-скрипта импортёра (по умолчанию: import:run,
#                          используется только при --runner pnpm)
#   --log-dir DIR           Каталог для полных логов каждого курса (по умолчанию: REPORT_DIR/logs)
#
#   --runner pnpm|docker    Как запускать импортёр (по умолчанию: pnpm):
#                            - pnpm   — как раньше, требует pnpm и зависимости монорепо на хосте;
#                            - docker — через уже собранный образ воркера (`docker compose run`),
#                                      без установки pnpm/зависимостей на хост. Рекомендуется на
#                                      боевых серверах (см. docs/deployment/psr-migration.md).
#   --compose-file FILE     Compose-файл для --runner docker (можно указывать несколько раз,
#                          порядок сохраняется). По умолчанию: docker-compose.prod.yml и
#                          docker-compose.sel1.yml (относительно --repo-root).
#   --service NAME          Имя сервиса в compose для --runner docker (по умолчанию: worker)
#   --container-import-dir DIR
#                          Путь внутри контейнера, по которому смонтирован каталог с .mbz,
#                          для --runner docker (по умолчанию: /import). Хостовый --src-dir
#                          используется только для поиска и сортировки файлов на хосте —
#                          импортёру внутри контейнера передаётся
#                          "<container-import-dir>/<имя файла>", а не хостовый путь.
#   -h, --help              Эта справка
#
# Пример точной команды, которую скрипт выполняет на один файл:
#
#   --runner pnpm (по умолчанию):
#     cd <repo-root> && pnpm --filter @parta5/importer import:run -- \
#       --file /opt/psr/c7-export/backup-moodle2-course-12-....mbz \
#       --school psr --user admin@psr.parta5.ru
#
#   --runner docker (проверено вручную на sel1, dry-run по реальному курсу ПДД):
#     cd <repo-root> && docker compose -f docker-compose.prod.yml -f docker-compose.sel1.yml \
#       run --rm --no-deps -T worker \
#       node_modules/.bin/tsx ../../packages/importer/src/cli.ts \
#       --file /import/backup-moodle2-course-12-....mbz \
#       --school psr --user admin@psr.parta5.ru
#
# Что НЕ проверено (см. отчёт задачи S7): реальное время импорта одного курса на боевых
# объёмах (известно из Stage D: курс "ТЕСТ ПДД" — 52 урока/52 квиза/1035 вопросов — импортировался
# успешно, но точная длительность в спеке не зафиксирована), и полный список типов активностей
# Moodle, которые встретятся во всех 106 курсах ПСР (проверялись только 4 курса на C6).

set -euo pipefail

# ── Значения по умолчанию ────────────────────────────────────────────────────
SRC_DIR="./c7-export"
SCHOOL=""
USER_EMAIL=""
DRY_RUN=0
STATE_FILE=""
REPORT_DIR=""
REPORT_NAME=""
LIMIT=""
REPO_ROOT=""
PNPM_FILTER="@parta5/importer"
PNPM_SCRIPT="import:run"
LOG_DIR=""
RUNNER="pnpm"
declare -a COMPOSE_FILES=()
SERVICE="worker"
CONTAINER_IMPORT_DIR="/import"

usage() {
  # Печатает весь шапочный комментарий файла (между shebang и первой пустой
  # строкой перед кодом), не завязываясь на номера строк.
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --src-dir) SRC_DIR="$2"; shift 2 ;;
    --school) SCHOOL="$2"; shift 2 ;;
    --user) USER_EMAIL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --state-file) STATE_FILE="$2"; shift 2 ;;
    --report-dir) REPORT_DIR="$2"; shift 2 ;;
    --report-name) REPORT_NAME="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    --pnpm-filter) PNPM_FILTER="$2"; shift 2 ;;
    --pnpm-script) PNPM_SCRIPT="$2"; shift 2 ;;
    --log-dir) LOG_DIR="$2"; shift 2 ;;
    --runner) RUNNER="$2"; shift 2 ;;
    --compose-file) COMPOSE_FILES+=("$2"); shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --container-import-dir) CONTAINER_IMPORT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Неизвестный аргумент: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$SCHOOL" ] || [ -z "$USER_EMAIL" ]; then
  echo "ОШИБКА: --school и --user обязательны." >&2
  usage
  exit 1
fi

case "$RUNNER" in
  pnpm|docker) ;;
  *) echo "ОШИБКА: --runner должен быть 'pnpm' или 'docker' (получено: '$RUNNER')." >&2; exit 1 ;;
esac

if [ "${#COMPOSE_FILES[@]}" -eq 0 ]; then
  COMPOSE_FILES=(docker-compose.prod.yml docker-compose.sel1.yml)
fi

[ -n "$STATE_FILE" ] || STATE_FILE="$SRC_DIR/.psr-import-state.tsv"
[ -n "$REPORT_DIR" ] || REPORT_DIR="$SRC_DIR/reports"
if [ -z "$REPORT_NAME" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    REPORT_NAME="psr-import-dryrun-report"
  else
    REPORT_NAME="psr-import-report"
  fi
fi
[ -n "$LOG_DIR" ] || LOG_DIR="$REPORT_DIR/logs"

if [ -z "$REPO_ROOT" ]; then
  if command -v git >/dev/null 2>&1 && git -C "$(dirname "$0")" rev-parse --show-toplevel >/dev/null 2>&1; then
    REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
  else
    REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  fi
fi

mkdir -p "$REPORT_DIR" "$LOG_DIR"
touch "$STATE_FILE"

# ── Проверки перед стартом в docker-режиме ───────────────────────────────────
# Делается один раз до цикла по файлам, а не при первой ошибке запуска — чтобы
# не засыпать экран 106 одинаковыми "сервис не найден" (как уже было со скриптом
# экспорта).
check_docker_prereqs() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ОШИБКА: --runner docker выбран, но команда 'docker' не найдена в PATH." >&2
    exit 1
  fi

  local compose_args=() cf
  for cf in "${COMPOSE_FILES[@]}"; do compose_args+=(-f "$cf"); done

  local services
  if ! services="$(cd "$REPO_ROOT" && docker compose "${compose_args[@]}" config --services 2>&1)"; then
    echo "ОШИБКА: не удалось прочитать конфигурацию docker compose из $REPO_ROOT (файлы: ${COMPOSE_FILES[*]})." >&2
    echo "$services" >&2
    exit 1
  fi

  if ! printf '%s\n' "$services" | grep -qx "$SERVICE"; then
    echo "ОШИБКА: сервис '$SERVICE' не найден в конфигурации docker compose (файлы: ${COMPOSE_FILES[*]}, каталог: $REPO_ROOT)." >&2
    echo "Доступные сервисы:" >&2
    printf '%s\n' "$services" | sed 's/^/  - /' >&2
    exit 1
  fi

  local full_config
  full_config="$(cd "$REPO_ROOT" && docker compose "${compose_args[@]}" config 2>/dev/null)"
  if ! printf '%s\n' "$full_config" | awk -v svc="$SERVICE" -v dir="$CONTAINER_IMPORT_DIR" '
    $0 ~ "^  "svc":[[:space:]]*$" { insvc=1; next }
    insvc && /^  [A-Za-z0-9_.-]+:[[:space:]]*$/ { insvc=0 }
    insvc && index($0, dir) { found=1 }
    END { exit !found }
  '; then
    echo "ОШИБКА: в сервисе '$SERVICE' не найден смонтированный каталог '$CONTAINER_IMPORT_DIR'." >&2
    echo "Проверьте --container-import-dir и volumes сервиса '$SERVICE' в docker-compose*.yml." >&2
    exit 1
  fi
}

if [ "$RUNNER" = "docker" ]; then
  check_docker_prereqs
fi

CSV_FILE="$REPORT_DIR/${REPORT_NAME}.csv"
MD_FILE="$REPORT_DIR/${REPORT_NAME}.md"

echo "file,course_title,course_slug,status,duration_sec,modules,lessons,blocks,quizzes,questions_imported,questions_skipped,skipped_activities,error" \
  > "$CSV_FILE"

# ── Агрегаты для сводки в Markdown ───────────────────────────────────────────
declare -A AGG_SKIPPED_QTYPE=()      # тип вопроса -> суммарное количество пропущено
declare -A AGG_SKIPPED_ACTIVITY=()   # "modulename | reason" -> количество курсов, где встретилось
TOTAL_OK=0
TOTAL_SKIPPED=0
TOTAL_FAILED=0

csv_escape() {
  # Экранирование поля для CSV: удваиваем кавычки, оборачиваем в кавычки.
  local s="$1"
  s="${s//\"/\"\"}"
  printf '"%s"' "$s"
}

md_escape() {
  # Экранирование поля для ячейки markdown-таблицы: убираем переносы строк,
  # экранируем вертикальную черту, чтобы не сломать разметку таблицы.
  local s="$1"
  s="${s//$'\n'/ }"
  s="${s//|/\\|}"
  printf '%s' "$s"
}

declare -a MD_ROWS=()

is_done() {
  local fname="$1"
  [ "$DRY_RUN" -eq 1 ] && return 1  # в dry-run состояние не учитывается
  awk -F'\t' -v f="$fname" '$1 == f && $2 == "done" {found=1} END{exit !found}' "$STATE_FILE"
}

mark_done() {
  local fname="$1"
  [ "$DRY_RUN" -eq 1 ] && return 0
  printf '%s\t%s\t%s\n' "$fname" "done" "$(date -Iseconds)" >> "$STATE_FILE"
}

# ── Список файлов, отсортированный по id курса (4-е поле имени через дефис) ──
declare -a FILES=()
while IFS= read -r f; do
  [ -n "$f" ] && FILES+=("$f")
done < <(
  find "$SRC_DIR" -maxdepth 1 -type f -name '*.mbz' 2>/dev/null | while IFS= read -r f; do
    base="$(basename "$f")"
    id="$(echo "$base" | cut -d'-' -f4)"
    case "$id" in
      ''|*[!0-9]*) id=999999 ;;  # не распознали id — в конец списка
    esac
    printf '%06d\t%s\n' "$id" "$f"
  done | sort -n | cut -f2-
)

if [ -n "$LIMIT" ]; then
  FILES=("${FILES[@]:0:$LIMIT}")
fi

echo "Найдено .mbz: ${#FILES[@]} в $SRC_DIR (dry-run=$DRY_RUN, runner=$RUNNER)"

# ── Импорт одного файла ──────────────────────────────────────────────────────
run_one() {
  local file="$1"
  local base status="ERROR" duration=0 course_title="н/д" course_slug="н/д"
  local modules="н/д" lessons="н/д" blocks="н/д" quizzes="н/д" questions="н/д"
  local skipped_qtype="" skipped_activities="" error_msg=""
  base="$(basename "$file")"

  local logfile="$LOG_DIR/${base%.mbz}.log"
  local dry_flag=()
  [ "$DRY_RUN" -eq 1 ] && dry_flag=(--dry-run)

  local start_ts end_ts
  start_ts="$(date +%s)"

  set +e
  if [ "$RUNNER" = "docker" ]; then
    local compose_args=() cf
    for cf in "${COMPOSE_FILES[@]}"; do compose_args+=(-f "$cf"); done
    (
      cd "$REPO_ROOT" && \
      docker compose "${compose_args[@]}" run --rm --no-deps -T "$SERVICE" \
        node_modules/.bin/tsx ../../packages/importer/src/cli.ts \
        --file "$CONTAINER_IMPORT_DIR/$base" --school "$SCHOOL" --user "$USER_EMAIL" "${dry_flag[@]}"
    ) > "$logfile" 2>&1
  else
    (
      cd "$REPO_ROOT" && \
      pnpm --filter "$PNPM_FILTER" "$PNPM_SCRIPT" -- \
        --file "$file" --school "$SCHOOL" --user "$USER_EMAIL" "${dry_flag[@]}"
    ) > "$logfile" 2>&1
  fi
  local rc=$?
  set -e

  end_ts="$(date +%s)"
  duration=$(( end_ts - start_ts ))

  if [ "$rc" -eq 0 ]; then
    status="OK"
  else
    status="ERROR"
    error_msg="$(tail -5 "$logfile" | tr '\n' ' ' | sed 's/  */ /g')"
  fi

  # Извлечение полей отчёта (см. packages/importer/src/report-format.ts).
  local line
  line="$(grep -m1 '^Курс: ' "$logfile" || true)"
  if [ -n "$line" ]; then
    course_title="$(echo "$line" | sed -E 's/^Курс: (.*) \(([^)]+)\)$/\1/; s/^Курс: //')"
    course_slug="$(echo "$line" | grep -oP '(?<=\()[^)]+(?=\)$)' || echo "н/д")"
  fi

  line="$(grep -m1 '^Модулей: ' "$logfile" || true)"
  if [ -n "$line" ]; then
    modules="$(echo "$line" | grep -oP '(?<=Модулей: )[0-9]+' || echo "н/д")"
    lessons="$(echo "$line" | grep -oP '(?<=уроков: )[0-9]+' || echo "н/д")"
    blocks="$(echo "$line" | grep -oP '(?<=блоков: )[0-9]+' || echo "н/д")"
  fi

  line="$(grep -m1 '^Квизов: ' "$logfile" || true)"
  if [ -n "$line" ]; then
    quizzes="$(echo "$line" | grep -oP '(?<=Квизов: )[0-9]+' || echo "н/д")"
    questions="$(echo "$line" | grep -oP '(?<=вопросов: )[0-9]+' || echo "н/д")"
  fi

  skipped_qtype="$(grep -m1 '^Пропущено вопросов по типам: ' "$logfile" | sed -E 's/^Пропущено вопросов по типам: //' || true)"

  if grep -q '^Пропущенные активности:' "$logfile"; then
    skipped_activities="$(sed -n '/^Пропущенные активности:/,/^$/p' "$logfile" | grep '^- \[' | sed 's/^- //' | paste -sd '; ' -)"
  fi

  echo "$(csv_escape "$base"),$(csv_escape "$course_title"),$(csv_escape "$course_slug"),$(csv_escape "$status"),$(csv_escape "$duration"),$(csv_escape "$modules"),$(csv_escape "$lessons"),$(csv_escape "$blocks"),$(csv_escape "$quizzes"),$(csv_escape "$questions"),$(csv_escape "$skipped_qtype"),$(csv_escape "$skipped_activities"),$(csv_escape "$error_msg")" \
    >> "$CSV_FILE"

  # Строка markdown-таблицы строится напрямую из тех же переменных, а не
  # обратным разбором CSV — в CSV поля в кавычках могут содержать запятые
  # (например, "essay=3, ddwtos=1"), наивный split по запятой их бы порвал.
  MD_ROWS+=("$(printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |' \
    "$(md_escape "$base")" "$(md_escape "$course_title")" "$(md_escape "$status")" "$(md_escape "$duration")" \
    "$(md_escape "$modules")" "$(md_escape "$lessons")" "$(md_escape "$blocks")" "$(md_escape "$quizzes")" \
    "$(md_escape "$questions")" "$(md_escape "$skipped_qtype")" "$(md_escape "$skipped_activities")" "$(md_escape "$error_msg")")")

  # ── Аггрегация для markdown-сводки ──
  if [ -n "$skipped_qtype" ]; then
    IFS=',' read -ra pairs <<< "$skipped_qtype"
    for p in "${pairs[@]}"; do
      p="$(echo "$p" | tr -d ' ')"
      [ -z "$p" ] && continue
      local qtype="${p%%=*}"
      local qcount="${p##*=}"
      case "$qcount" in *[!0-9]*|'') continue ;; esac
      AGG_SKIPPED_QTYPE["$qtype"]=$(( ${AGG_SKIPPED_QTYPE["$qtype"]:-0} + qcount ))
    done
  fi
  if [ -n "$skipped_activities" ]; then
    IFS=';' read -ra acts <<< "$skipped_activities"
    for a in "${acts[@]}"; do
      local modulename reason key
      modulename="$(echo "${a# }" | grep -oP '(?<=^\[)[^]]+(?=\])' | head -1)"
      reason="$(echo "$a" | sed -E 's/^ *\[[^]]+\] [^—]+— *//')"
      modulename="${modulename:-неизвестно}"
      reason="${reason:-неизвестно}"
      key="${modulename} | ${reason}"
      AGG_SKIPPED_ACTIVITY["$key"]=$(( ${AGG_SKIPPED_ACTIVITY["$key"]:-0} + 1 ))
    done
  fi

  if [ "$status" = "OK" ]; then
    mark_done "$base"
    echo "OK    $base (${duration}с) курс='$course_title' модулей=$modules квизов=$quizzes вопросов=$questions"
    TOTAL_OK=$((TOTAL_OK + 1))
  else
    echo "ERROR $base (${duration}с): $error_msg"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
}

for f in "${FILES[@]}"; do
  base="$(basename "$f")"
  if is_done "$base"; then
    echo "ПРОПУСК (уже импортирован) $base"
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
    continue
  fi
  run_one "$f" || true
done

# ── Markdown-отчёт ────────────────────────────────────────────────────────
{
  echo "# Отчёт о батч-импорте ПСР $( [ "$DRY_RUN" -eq 1 ] && echo '(DRY-RUN)' )"
  echo
  echo "Дата: $(date -Iseconds)"
  echo
  echo "Каталог источника: \`$SRC_DIR\`"
  echo
  echo "Обработано в этом запуске: ${#FILES[@]}, успешно: $TOTAL_OK, пропущено (уже было): $TOTAL_SKIPPED, ошибок: $TOTAL_FAILED"
  echo
  echo "Полный CSV: \`$(basename "$CSV_FILE")\`"
  echo
  echo "## Курсы"
  echo
  echo "| Файл | Курс | Статус | Время, с | Модулей | Уроков | Блоков | Квизов | Вопросов | Пропущено вопросов | Пропущенные активности | Ошибка |"
  echo "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  for row in "${MD_ROWS[@]}"; do
    printf '%s\n' "$row"
  done
  echo
  echo "## Сводка: что теряем"
  echo
  echo "### Пропущенные типы вопросов (суммарно по всем обработанным курсам)"
  echo
  if [ "${#AGG_SKIPPED_QTYPE[@]}" -eq 0 ]; then
    echo "Не обнаружено."
  else
    echo "| Тип вопроса | Пропущено, шт. |"
    echo "| --- | --- |"
    for k in "${!AGG_SKIPPED_QTYPE[@]}"; do
      echo "| $k | ${AGG_SKIPPED_QTYPE[$k]} |"
    done
  fi
  echo
  echo "### Пропущенные типы активностей (в скольких курсах встретились)"
  echo
  if [ "${#AGG_SKIPPED_ACTIVITY[@]}" -eq 0 ]; then
    echo "Не обнаружено."
  else
    echo "| Тип активности | Курсов |"
    echo "| --- | --- |"
    for k in "${!AGG_SKIPPED_ACTIVITY[@]}"; do
      echo "| $k | ${AGG_SKIPPED_ACTIVITY[$k]} |"
    done
  fi
} > "$MD_FILE"

echo
echo "ИТОГО: успешно=$TOTAL_OK, пропущено=$TOTAL_SKIPPED, ошибок=$TOTAL_FAILED"
echo "CSV: $CSV_FILE"
echo "Markdown: $MD_FILE"
if [ "$TOTAL_FAILED" -gt 0 ]; then
  echo "Есть ошибки — см. столбец 'error' в CSV/MD и логи в $LOG_DIR"
fi

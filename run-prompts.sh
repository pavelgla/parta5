#!/bin/bash
# Парта5: последовательный запуск промптов 1..13 через Claude Code CLI (Sonnet)
# Этап A (hardening) + начало Этапа B (квиз) — см. docs/SUPERPLAN.md
# Каждый промпт = отдельная сессия (чистый контекст); между промптами — git commit
#
# Использование:
#   ./run-prompts.sh          — все промпты с 1-го
#   ./run-prompts.sh 5        — начать с промпта 5
#   ./run-prompts.sh 5 8      — промпты с 5 по 8
#
# Требования: claude CLI, python3, git, docker (поднятый db для промптов 3/4/9/13)

set -e
cd "$(dirname "$0")"

START=${1:-1}
END=${2:-999}

# Извлечение тела промпта из PROMPTS.md по номеру (1-indexed)
# Парсит первый ```...``` блок в секции ## ПРОМПТ N:
# (prettier нормализует ~~~ в ``` — извлекаем по ```)
extract_prompt() {
  local num=$1
  python3 - "$num" <<'PYEOF'
import re, sys

num = int(sys.argv[1])

with open('PROMPTS.md', encoding='utf-8') as f:
    content = f.read()

parts = re.split(r'^## ПРОМПТ \d+:', content, flags=re.MULTILINE)

if len(parts) <= num:
    print(f"Промпт {num} не найден в PROMPTS.md", file=sys.stderr)
    sys.exit(1)

section = parts[num]

m = re.search(r'```\n(.*?)```', section, re.DOTALL)
if not m:
    print(f"``` блок не найден в промпте {num}", file=sys.stderr)
    sys.exit(1)

print(m.group(1).rstrip())
PYEOF
}

PROMPTS=(
  "A1|feat(rbac): role procedures in tRPC + typed session role"
  "A1b|feat(rbac): apply role procedures + ownership to all routers"
  "A3|feat(db): RLS policies on BlockView/FileAsset/VideoAsset/LearningEvent"
  "A4|feat(db): least-privilege app role parta5_app"
  "A5|fix(compose): web S3/Redis env, closed ports, healthchecks"
  "A6|fix(enrollment): PUBLISHED-only enroll, remove dev test pages"
  "A7|fix(course): slug race + TD-001 strict block.create validation"
  "A8|feat(worker): retry/backoff/timeout/concurrency"
  "A9|test(e2e): published demo course + honest student journey + authz"
  "A10|test(ci): vitest job + negative authz unit tests"
  "B1|docs(adr): ADR-004 assessment data model"
  "B2|feat(quiz): @parta5/quiz package — schemas + auto-grade"
  "B3|feat(db): quiz Prisma models + migration + RLS"
  "C1|feat(importer): @parta5/importer — mbz extraction + backup manifest parsers"
  "C2|feat(importer): question parsers — backup questions.xml + Moodle XML"
  "C3a|feat(importer): importCourse — structure + page/label/resource/url blocks"
  "C3b|feat(importer): mod_quiz import + QUIZ content block type"
  "C4|feat(importer): parta5-import CLI with dry-run report"
  "C5|feat(import): course-import worker job + mbz upload UI"
  "C8|feat(course): school kind + relaxed publish validation for non-schools"
)

TOTAL=${#PROMPTS[@]}

for i in "${!PROMPTS[@]}"; do
  NUM=$((i + 1))
  IFS='|' read -r LABEL DESC <<< "${PROMPTS[$i]}"

  if [ "$NUM" -lt "$START" ]; then continue; fi
  if [ "$NUM" -gt "$END" ]; then break; fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Промпт $NUM/$TOTAL [$LABEL]"
  echo "  $DESC"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  PROMPT_TEXT=$(extract_prompt "$NUM")
  if [ -z "$PROMPT_TEXT" ]; then
    echo "ОШИБКА: не удалось извлечь промпт $NUM"
    exit 1
  fi

  claude -p "$PROMPT_TEXT" --model sonnet --dangerously-skip-permissions

  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    git add -A
    git commit -m "$DESC" || true
    echo ""
    echo "  Закоммичено: $DESC"
  else
    echo ""
    echo "  [$LABEL]: нет изменений для коммита"
  fi

  if [ "$NUM" -lt "$TOTAL" ] && [ "$NUM" -lt "$END" ]; then
    echo ""
    echo "  Пауза 3 сек перед следующим промптом..."
    sleep 3
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Готово!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git log --oneline -15

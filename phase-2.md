# Phase 2 — тесты и задания

> Исполнительный сценарий для Claude Code. Прочитай этот файл целиком, прочитай `CLAUDE.md`, проверь, что Phase 1 закрыт (`git tag --list "v0.2.0-phase1"`), потом выполняй шаги строго по порядку.

**Цель фазы:** добавить полноценные тесты с авто-проверкой и задания с ручной проверкой, чтобы учитель мог не только давать материал, но и оценивать его освоение. После Phase 2 на платформе можно провести реальный учебный курс с контрольными работами и домашними заданиями.

**Критерий готовности фазы:** учитель в RunStart-курсе создаёт тест с 8 типами вопросов и задание с рубрикой; 30 учеников проходят тест, получают авто-оценки; учитель руками проверяет задания; в gradebook виден журнал.

---

## Правила выполнения

Те же, что в `phase-0.md` и `phase-1.md`. Кратко:

1. Перед каждым шагом — `git status` чистый.
2. Выполняй ровно то, что описано.
3. Прогоняй проверки. Красные — исправляй, не двигайся.
4. Коммить с сообщением из «Коммит».
5. Отмечай галочку в чек-листе → коммит `chore: mark phase2 step N complete`.

Если шаг не получается — НЕ выдумывай. Остановись, опиши проблему, спроси Paul.

---

## Архитектурные решения

Зафиксируй в ADR в начале фазы (шаг 1):

- **ADR-004: Quiz и Assignment — top-level активности, не блоки контента.** Причина: тесты имеют состояния (попытки, таймеры, проверка), асинхронные процессы (auto-grade, ручная оценка), отдельные UI. Это не подходит под модель «блок в уроке». Но ссылка на quiz/assignment может быть встроена в урок через специальный `ContentBlock.type = ACTIVITY_REFERENCE`, чтобы учитель мог поместить тест в нужное место в уроке.
- **ADR-005: Question.body и Question.explanation — TipTap JSON.** Не plain text и не Markdown. Это нужно для будущего: формулы (KaTeX в Phase 5), картинки в вопросах, форматирование. Сейчас TipTap stack уже есть в редакторе курсов (Phase 1).
- **ADR-006: Snapshot ответов вопросов в QuestionRevision при submit attempt.** Учитель может отредактировать вопрос после того как ученик его прошёл; история должна остаться неизменной. Каждый Question имеет линию QuestionRevision'ов, в QuizResponse ссылка на конкретную ревизию.

---

## Секреты через Bitwarden

Новые секреты для Phase 2 не нужны. Используется существующая инфраструктура из Phase 0-1.

---

## Чек-лист

- [ ] Шаг 1 — модель данных банка вопросов (`QuestionBank`, `Question`, `QuestionRevision`) + ADR
- [ ] Шаг 2 — пакет `@parta5/quiz`: zod schemas и engine авто-оценки для 8 типов вопросов
- [ ] Шаг 3 — Question Bank UI: иерархия категорий, CRUD вопросов, превью
- [ ] Шаг 4 — модель `Quiz` и `QuizQuestion`, привязка к уроку через `ACTIVITY_REFERENCE` блок
- [ ] Шаг 5 — модели `QuizAttempt` и `QuizResponse`, auto-grade при submit
- [ ] Шаг 6 — UI прохождения теста (таймер, навигация, auto-save, авто-submit по истечении)
- [ ] Шаг 7 — модель `Assignment` и `AssignmentSubmission` + UI учителя/ученика
- [ ] Шаг 8 — ручная оценка assignment с рубриками + возврат на доработку
- [ ] Шаг 9 — Gradebook: журнал оценок по курсу с экспортом в CSV
- [ ] Шаг 10 — демо-курс с тестом и заданием + e2e тесты

---

## Шаг 1 — модель данных банка вопросов

**Цель:** структура для хранения вопросов с историей ревизий и категориями.

**Что сделать:**

1. Создай `docs/architecture/0004-quiz-as-top-level-activity.md`, `docs/architecture/0005-tiptap-question-body.md`, `docs/architecture/0006-question-revision-snapshot.md` — три ADR со статусом `accepted`. Контекст, решение, альтернативы (1 параграф каждое).
2. В Prisma schema добавь модели:
   ```prisma
   model QuestionBank {
     id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId    String   @db.Uuid
     parentId    String?  @db.Uuid
     parent      QuestionBank?  @relation("BankHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
     children    QuestionBank[] @relation("BankHierarchy")
     name        String
     description String?
     // null courseId = school-level shared bank, иначе scope ограничен курсом
     courseId    String?  @db.Uuid
     course      Course?  @relation(fields: [courseId], references: [id], onDelete: Cascade)
     createdById String   @db.Uuid
     createdAt   DateTime @default(now())
     questions   Question[]
     @@index([schoolId])
     @@index([courseId])
   }

   enum QuestionType {
     SINGLE_CHOICE      // ровно один правильный вариант
     MULTIPLE_CHOICE    // несколько правильных
     TRUE_FALSE         // true / false
     SHORT_ANSWER       // короткий ответ (текст или regex)
     NUMERIC            // число с допуском
     MATCHING           // сопоставление пар
     CLOZE              // пропуски в тексте (как Moodle Embedded)
     ESSAY              // длинный текст, ручная проверка
   }

   model Question {
     id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId     String   @db.Uuid
     bankId       String   @db.Uuid
     bank         QuestionBank @relation(fields: [bankId], references: [id], onDelete: Cascade)
     type         QuestionType
     body         Json                  // TipTap content { type: 'doc', content: [...] }
     explanation  Json?                 // TipTap content или null
     data         Json                  // type-specific (choices, correctValue, etc.) — schemas в @parta5/quiz
     tags         String[]              @default([])
     difficulty   Int?                  // 1..5
     defaultScore Float    @default(1)  // на сколько баллов вопрос обычно стоит
     createdById  String   @db.Uuid
     createdAt    DateTime @default(now())
     updatedAt    DateTime @updatedAt
     deletedAt    DateTime?
     revisions    QuestionRevision[]
     @@index([schoolId])
     @@index([bankId])
     @@index([type])
   }

   model QuestionRevision {
     id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId     String   @db.Uuid
     questionId   String   @db.Uuid
     question     Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
     body         Json
     explanation  Json?
     data         Json
     createdById  String   @db.Uuid
     createdAt    DateTime @default(now())
     @@index([questionId, createdAt(sort: Desc)])
   }
   ```
3. Триггер: при `update` `Question` (изменение body/data/explanation) автоматически создаётся `QuestionRevision` с предыдущими значениями. Реализуй в Prisma middleware в `packages/db/src/middleware/question-revisions.ts`.
4. tRPC роутер `questionBank.ts`: `tree({courseId?})`, `create({name, parentId?, courseId?})`, `rename`, `move`, `delete`.
5. Миграция: `prisma migrate dev --name question_bank`. **Проверь руками SQL миграции** перед применением — Prisma иногда генерирует некорректный SQL для self-references.

**Проверка:**

```bash
pnpm --filter @parta5/db exec prisma migrate dev
pnpm --filter web typecheck

# Ручная: создай через Prisma Studio QuestionBank иерархию:
# "Все вопросы курса"
#   ├── "Глава 1"
#   └── "Глава 2"
#       └── "Контрольные"
# Проверь, что cascade delete удаляет дочерние банки.
```

**Коммит:**

```
feat(quiz): add question bank schema with hierarchy and revisions
```

---

## Шаг 2 — пакет `@parta5/quiz`: schemas и auto-grade engine

**Цель:** один источник правды для структуры данных вопроса и для алгоритма проверки. Используется и фронтом (валидация формы), и сервером (auto-grade), и будущим импортёром из Moodle (Phase 3).

**Что сделать:**

1. Создай пакет `packages/quiz`:
   - `package.json` name `@parta5/quiz`, dep `zod`.
2. `src/types.ts` — zod-схемы для `data` каждого типа:
   ```ts
   import { z } from 'zod';

   const ChoiceSchema = z.object({
     id: z.string(),
     content: z.unknown(),       // TipTap JSON
     isCorrect: z.boolean(),
     feedback: z.unknown().optional(),
   });

   export const SingleChoiceData = z.object({
     choices: z.array(ChoiceSchema).min(2).refine(arr => arr.filter(c => c.isCorrect).length === 1, 'exactly one correct'),
   });

   export const MultipleChoiceData = z.object({
     choices: z.array(ChoiceSchema).min(2),
     scoringMode: z.enum(['all_or_nothing', 'partial']).default('partial'),
     penaltyPerWrong: z.number().min(0).max(1).default(0),
   });

   export const TrueFalseData = z.object({ correctAnswer: z.boolean() });

   export const ShortAnswerData = z.object({
     acceptedAnswers: z.array(z.object({
       text: z.string(),
       caseSensitive: z.boolean().default(false),
       matchMode: z.enum(['exact', 'contains', 'regex']).default('exact'),
     })).min(1),
   });

   export const NumericData = z.object({
     correctValue: z.number(),
     tolerance: z.number().min(0).default(0),
     unit: z.string().optional(),
   });

   export const MatchingData = z.object({
     pairs: z.array(z.object({
       id: z.string(),
       left: z.unknown(),         // TipTap
       right: z.unknown(),        // TipTap
     })).min(2),
     distractors: z.array(z.unknown()).default([]),  // ложные правые варианты
   });

   export const ClozeGapSchema = z.discriminatedUnion('type', [
     z.object({ id: z.string(), type: z.literal('text'), acceptedAnswers: z.array(z.string()).min(1), caseSensitive: z.boolean().default(false) }),
     z.object({ id: z.string(), type: z.literal('choice'), choices: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).min(2) }),
     z.object({ id: z.string(), type: z.literal('numeric'), correctValue: z.number(), tolerance: z.number().default(0) }),
   ]);

   export const ClozeData = z.object({
     template: z.string(),         // "Столица Франции — {{gap-1}}, население {{gap-2}}."
     gaps: z.array(ClozeGapSchema).min(1),
   });

   export const EssayData = z.object({
     rubric: z.string().optional(),
     sampleAnswer: z.string().optional(),
     minWords: z.number().int().min(0).optional(),
     maxWords: z.number().int().min(0).optional(),
   });

   export const QuestionData = z.discriminatedUnion('type', [
     z.object({ type: z.literal('SINGLE_CHOICE'), data: SingleChoiceData }),
     z.object({ type: z.literal('MULTIPLE_CHOICE'), data: MultipleChoiceData }),
     z.object({ type: z.literal('TRUE_FALSE'), data: TrueFalseData }),
     z.object({ type: z.literal('SHORT_ANSWER'), data: ShortAnswerData }),
     z.object({ type: z.literal('NUMERIC'), data: NumericData }),
     z.object({ type: z.literal('MATCHING'), data: MatchingData }),
     z.object({ type: z.literal('CLOZE'), data: ClozeData }),
     z.object({ type: z.literal('ESSAY'), data: EssayData }),
   ]);
   ```
3. `src/response.ts` — схемы для ответов ученика:
   - `SingleChoiceResponse: { choiceId: string }`
   - `MultipleChoiceResponse: { choiceIds: string[] }`
   - `TrueFalseResponse: { answer: boolean }`
   - `ShortAnswerResponse: { text: string }`
   - `NumericResponse: { value: number }`
   - `MatchingResponse: { pairs: [{leftId, rightId}] }`
   - `ClozeResponse: { answers: Record<gapId, string|number|choiceId> }`
   - `EssayResponse: { html: string, plainText: string, wordCount: number }`
4. `src/grade.ts` — pure function `grade(question, response): GradeResult`:
   ```ts
   export type GradeResult = {
     score: number;          // 0..1
     maxScore: number;       // обычно 1, для some types может быть >1
     autoGraded: boolean;    // false для ESSAY
     feedback?: string;      // объяснение оценки
     itemizedScores?: Record<string, { correct: boolean; points: number; expected?: unknown }>;  // для CLOZE/MATCHING
   };
   ```
   - SINGLE_CHOICE: 1 если choiceId совпадает с isCorrect=true, иначе 0.
   - MULTIPLE_CHOICE: partial = (правильных выбрал − штраф*ошибочных) / всего правильных, clamp в [0,1]; all_or_nothing = 1 если множества совпадают, иначе 0.
   - TRUE_FALSE: 1 / 0.
   - SHORT_ANSWER: для каждого acceptedAnswer пробуем matchMode (exact/contains/regex), хотя бы один совпал — 1, иначе 0.
   - NUMERIC: `Math.abs(response.value - correctValue) <= tolerance` → 1, иначе 0.
   - MATCHING: per-pair, доля правильных пар = score.
   - CLOZE: per-gap, доля правильных = score, itemizedScores per gap.
   - ESSAY: `autoGraded: false`, score = 0 пока учитель не проверит.
5. Юнит-тесты `__tests__/grade.test.ts` — для каждого типа минимум 4 кейса: всё правильно, всё неправильно, частично правильно, edge cases (пустой ответ, лишние варианты).
6. Покрытие `grade` — 100%.

**Проверка:**

```bash
pnpm --filter @parta5/quiz test --coverage
# coverage 100% по src/grade.ts

pnpm --filter @parta5/quiz typecheck
```

**Коммит:**

```
feat(quiz): add @parta5/quiz package with schemas and auto-grade engine for 8 types
```

---

## Шаг 3 — Question Bank UI

**Цель:** учитель видит дерево банков, перемещается по нему, создаёт/редактирует вопросы.

**Что сделать:**

1. Страница `/courses/[id]/edit/bank`:
   - Левая колонка: дерево банков (`QuestionBank` иерархия). Кнопка «+» рядом с каждым — создать дочерний банк. Контекстное меню: переименовать, удалить, переместить.
   - Правая колонка: список вопросов выбранного банка (таблица — тип, body preview, теги, difficulty, дата изменения). Кнопка «+ Вопрос».
2. Страница `/courses/[id]/edit/bank/question/[questionId]`:
   - Сверху: select типа вопроса (только при создании; после сохранения тип менять нельзя — это требует пересоздания data).
   - Слева:
     - **Body** — TipTap редактор. Поддерживает: bold/italic, lists, code, inline formula placeholder (без рендеринга в Phase 2 — просто `<span class="math">$x^2$</span>`).
     - **Explanation** — TipTap редактор (опционально, показывается ученику после ответа).
     - **Tags** — chips input с автокомплитом по существующим тегам школы.
     - **Difficulty** — звёзды 1-5.
     - **Default score** — number input (1 по умолчанию).
   - Справа: type-specific редактор данных. Отдельный компонент на каждый тип:
     - `SingleChoiceEditor`: добавить вариант, отметить правильный (радио), удалить.
     - `MultipleChoiceEditor`: чекбокс на каждом, scoring mode (all-or-nothing / partial), penalty per wrong.
     - `TrueFalseEditor`: радио True/False.
     - `ShortAnswerEditor`: список accepted answers, на каждом — text, matchMode select, caseSensitive checkbox.
     - `NumericEditor`: correctValue, tolerance, unit.
     - `MatchingEditor`: список пар (left | right), кнопка «Добавить distractor».
     - `ClozeEditor`: textarea с template, авто-детект `{{gap-N}}`, под каждым gap — настройки (тип, варианты).
     - `EssayEditor`: rubric textarea, sampleAnswer textarea, min/max words.
   - Снизу: «Сохранить», «Сохранить и закрыть», «Превью».
3. Превью-режим: показывает вопрос как ученик увидит (без правильных ответов). Можно симулировать ответ и нажать «Проверить» → вызывается `grade()` локально, показывается результат.
4. tRPC роутер `question.ts`:
   - `list({bankId, filters?})`, `byId(id)`, `create({bankId, type, body, data, explanation?, tags?})`, `update`, `delete` (soft, ставит `deletedAt`), `getRevisions(id)`.
   - В `create`/`update` — валидация через `QuestionData` discriminated union из `@parta5/quiz`.
5. Импорт TipTap инстансов сделать переиспользуемыми — `apps/web/components/tiptap/editor.tsx` обёртка с базовыми экстеншенами.

**Проверка:**

Ручная:
1. Создай иерархию банков на 3 уровня.
2. Создай по одному вопросу каждого из 8 типов. Сохрани, открой превью, симулируй ответ, проверь grade.
3. Отредактируй вопрос — в Prisma Studio видна QuestionRevision с предыдущими данными.

```bash
pnpm --filter web typecheck
pnpm --filter web build
```

**Коммит:**

```
feat(quiz): question bank ui with hierarchy and per-type editors
```

---

## Шаг 4 — `Quiz` модель + привязка к уроку

**Цель:** учитель собирает тест из вопросов банка, настраивает правила, встраивает в урок.

**Что сделать:**

1. В Prisma schema добавь:
   ```prisma
   model Quiz {
     id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId          String   @db.Uuid
     courseId          String   @db.Uuid
     course            Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
     title             String
     description       Json?                                       // TipTap
     timeLimitMinutes  Int?                                         // null = без лимита
     maxAttempts       Int?                                         // null = бесконечно
     passingScorePct   Int?                                         // 0..100, null = без порога
     shuffleQuestions  Boolean  @default(false)
     shuffleChoices    Boolean  @default(false)
     showFeedback      QuizFeedbackPolicy @default(AFTER_SUBMIT)
     availableFrom     DateTime?
     availableUntil    DateTime?
     status            QuizStatus @default(DRAFT)
     publishedAt       DateTime?
     createdById       String   @db.Uuid
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt
     questions         QuizQuestion[]
     attempts          QuizAttempt[]
     @@index([schoolId])
     @@index([courseId])
   }

   enum QuizFeedbackPolicy { AFTER_SUBMIT  AFTER_ATTEMPT_CLOSED  NEVER }
   enum QuizStatus { DRAFT  PUBLISHED  ARCHIVED }

   model QuizQuestion {
     id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId    String   @db.Uuid
     quizId      String   @db.Uuid
     quiz        Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
     questionId  String   @db.Uuid
     question    Question @relation(fields: [questionId], references: [id], onDelete: Restrict)
     order       Int
     weight      Float    @default(1)
     createdAt   DateTime @default(now())
     @@unique([quizId, questionId])
     @@index([quizId])
   }
   ```
   Миграция.
2. Расширь `ContentBlockType` enum: добавь `ACTIVITY_REFERENCE`. Это блок, который ссылается на Quiz или Assignment.
   `data: { activityType: 'quiz' | 'assignment', activityId: uuid }`.
3. tRPC роутер `quiz.ts`:
   - `list({courseId})`, `byId(id)`, `create({courseId, title})`, `update`, `delete`.
   - `publish(id)` — валидация (≥1 вопрос, корректные настройки) → `status = PUBLISHED`.
   - `addQuestion({quizId, questionId, weight?})`, `removeQuestion`, `reorderQuestions`.
   - `bulkAddFromBank({quizId, bankId, count?, randomize?})` — выбрать случайные N вопросов из банка.
4. Страницы редактора:
   - `/courses/[id]/edit/quizzes` — список тестов курса.
   - `/courses/[id]/edit/quizzes/new` — форма создания.
   - `/courses/[id]/edit/quizzes/[quizId]` — редактор:
     - Слева: метаданные + правила (time limit, attempts, passing score, feedback policy, availability dates).
     - Справа: список вопросов в тесте (drag-and-drop reorder), кнопка «+ Добавить из банка» открывает модалку выбора (фильтр по типу, тегам, банкам). Кнопки «Опубликовать»/«Снять с публикации».
5. В редакторе урока (Phase 1 шаг 5) добавь блок `ACTIVITY_REFERENCE` → модалка с выбором existing Quiz или создать новый. Блок рендерится в редакторе как карточка «Тест: <title> · N вопросов · 15 мин».

**Проверка:**

Ручная:
1. Создай тест «Контрольная по теме A» из 5 вопросов разных типов.
2. Настрой: time limit 10 минут, 2 попытки, passing 70%.
3. Опубликуй.
4. В уроке добавь блок ACTIVITY_REFERENCE → выбери тест → карточка появилась в редакторе урока.

```bash
pnpm --filter web typecheck
pnpm --filter @parta5/db exec prisma migrate dev --name quiz
```

**Коммит:**

```
feat(quiz): add Quiz model with attempts/timing config and lesson reference block
```

---

## Шаг 5 — `QuizAttempt`, `QuizResponse`, auto-grade

**Цель:** ученик начинает попытку → отвечает на вопросы → submit → авто-оценка → результат.

**Что сделать:**

1. Prisma schema:
   ```prisma
   enum QuizAttemptState { IN_PROGRESS  SUBMITTED  GRADED  EXPIRED }

   model QuizAttempt {
     id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId        String   @db.Uuid
     quizId          String   @db.Uuid
     quiz            Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
     userId          String   @db.Uuid
     user            User     @relation(fields: [userId], references: [id])
     attemptNumber   Int                                       // 1, 2, 3...
     state           QuizAttemptState @default(IN_PROGRESS)
     startedAt       DateTime @default(now())
     submittedAt     DateTime?
     gradedAt        DateTime?
     deadlineAt      DateTime?                                  // startedAt + timeLimitMinutes
     totalScore      Float?                                     // сумма баллов
     maxScore        Float?                                     // сумма weight'ов
     percentage      Float?                                     // 0..100
     passed          Boolean?                                   // null если passingScore не задан
     responses       QuizResponse[]
     @@unique([quizId, userId, attemptNumber])
     @@index([userId])
     @@index([quizId, state])
   }

   model QuizResponse {
     id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId           String   @db.Uuid
     attemptId          String   @db.Uuid
     attempt            QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
     quizQuestionId     String   @db.Uuid
     quizQuestion       QuizQuestion @relation(fields: [quizQuestionId], references: [id])
     questionRevisionId String   @db.Uuid                      // snapshot вопроса на момент начала attempt
     questionRevision   QuestionRevision @relation(fields: [questionRevisionId], references: [id])
     response           Json?                                   // схемы из @parta5/quiz/response
     score              Float?
     maxScore           Float
     autoGraded         Boolean  @default(false)
     graderNote         String?
     answeredAt         DateTime @default(now())
     @@unique([attemptId, quizQuestionId])
     @@index([attemptId])
   }
   ```
   Миграция.
2. tRPC роутер `quizAttempt.ts`:
   - `start({quizId})`:
     1. Проверить eligibility: курс PUBLISHED, у пользователя есть Enrollment, attempts < maxAttempts, availability window открыт.
     2. Для каждого `QuizQuestion` найти **последнюю** `QuestionRevision` (или создать «нулевую» из текущего состояния если нет ревизий) — сохранить её id.
     3. Создать `QuizAttempt` со state IN_PROGRESS, `deadlineAt = now() + timeLimitMinutes`.
     4. Создать `QuizResponse` пустые на все вопросы (response=null).
     5. Вернуть attempt с questions[] в правильном порядке (с учётом shuffleQuestions/shuffleChoices — порядок зашить в attempt, чтобы при рефреше был тот же).
   - `saveResponse({attemptId, questionId, response})`:
     - Проверить state == IN_PROGRESS и deadlineAt > now().
     - Обновить response в `QuizResponse`. Без оценки — оценка только на submit.
   - `submit({attemptId})`:
     - Загрузить все QuizResponse + QuestionRevision.
     - Для каждого: парсить response через `@parta5/quiz` response schema → вызвать `grade(revision.toQuestion(), response)`.
     - Записать score/maxScore/autoGraded в каждый QuizResponse.
     - Посчитать totalScore = sum(score * weight), maxScore = sum(maxScore * weight).
     - Если все autoGraded — state = GRADED, иначе SUBMITTED.
     - Записать LearningEvent: verb='submitted_quiz', result={percentage, passed}.
   - `myAttempts({quizId})` — история попыток ученика.
   - `attemptById(id)` — детали попытки (если userId совпадает или роль ≥ TEACHER в школе).
3. **Cron-like cleanup для истёкших попыток:** в `apps/worker` добавь job, который раз в минуту находит `QuizAttempt` со state=IN_PROGRESS и `deadlineAt < now()`, выполняет submit автоматически с тем что есть в responses. Используй BullMQ Repeatable Jobs.
4. Pure helper `apps/web/lib/quiz-grading.ts` — обёртка, которая берёт `QuizResponse[]` + `QuizQuestion[]` + `Quiz` и считает итоговую оценку (с учётом weight).

**Проверка:**

Юнит-тесты:
- `apps/web/__tests__/quiz-grading.test.ts` — синтетические attempts с разными вопросами.

Ручная:
1. Из браузера start attempt.
2. В Prisma Studio проверь, что создались QuizResponse с questionRevisionId, заполненные null.
3. saveResponse через tRPC (или через UI — но UI ещё не готов, шаг 6).
4. submit → ответы оценены, percentage посчитан.

```bash
pnpm --filter web typecheck
pnpm --filter web test
```

**Коммит:**

```
feat(quiz): add QuizAttempt and QuizResponse with revision snapshots and auto-grading
```

---

## Шаг 6 — UI прохождения теста

**Цель:** ученик проходит тест в комфортном интерфейсе с таймером и auto-save.

**Что сделать:**

1. Страница `/learn/[courseId]/quiz/[quizId]` — стартовая:
   - Метаданные: title, description, кол-во вопросов, time limit, попытки.
   - История прошлых попыток (если есть) с результатами.
   - Кнопка «Начать попытку» (disabled если maxAttempts достигнуто или window закрыт).
2. Страница `/learn/[courseId]/quiz/[quizId]/attempt/[attemptId]`:
   - Layout: header с таймером (sticky) + основное окно вопроса + nav-bar внизу.
   - Header:
     - Title теста.
     - Таймер обратного отсчёта (если deadlineAt задан). Цвет краснеет в последние 5 минут.
     - Прогресс «Вопрос 3 из 10».
   - Боковая панель (collapse on mobile): grid с номерами вопросов, цвета:
     - серый — не открывал.
     - синий — открывал, не ответил.
     - зелёный — ответил (response не null).
     - оранжевый — пометил «вернуться позже» (toggle).
   - Основная область — отдельный компонент `<QuestionView question={revision} response={response} onChange={save}>`:
     - `SingleChoiceQuestion` — radio list.
     - `MultipleChoiceQuestion` — checkbox list.
     - `TrueFalseQuestion` — radio True/False.
     - `ShortAnswerQuestion` — text input.
     - `NumericQuestion` — number input (+unit hint).
     - `MatchingQuestion` — drag-and-drop сопоставление или select на каждом left.
     - `ClozeQuestion` — рендерит template, на каждый gap — input/select в зависимости от gap.type.
     - `EssayQuestion` — TipTap editor + word counter.
   - На каждое изменение — debounce 500 ms → `quizAttempt.saveResponse`. Индикатор «Сохранено» / «Сохраняется».
   - Кнопки внизу: «Предыдущий», «Следующий», «Сдать тест».
3. Submit flow:
   - Подтверждение через модалку (особенно если есть неотвеченные вопросы — список их номеров).
   - Submit → редирект на `/learn/[courseId]/quiz/[quizId]/attempt/[attemptId]/result`.
4. Страница результата `result`:
   - Итоговая оценка (X/Y баллов, P%, passed/failed).
   - В зависимости от `showFeedback`:
     - AFTER_SUBMIT: по каждому вопросу — вопрос, твой ответ, правильный, объяснение, score.
     - AFTER_ATTEMPT_CLOSED: только итог сейчас, разбор — после закрытия attempts.
     - NEVER: только итог.
   - Кнопка «Начать новую попытку» (если есть в запасе).
5. Защита от cheating (минимальная):
   - На странице attempt — событие `window.onbeforeunload` → предупреждение.
   - При уходе со страницы (visibilitychange → hidden) → отметить в LearningEvent verb='quiz_tab_hidden' (для последующего ревью учителем, без блокировок).
   - НЕ блокируем copy-paste и не пытаемся делать lockdown browser — это уровень прокторинга, отдельная фаза.

**Проверка:**

Ручная (полный пайплайн):
1. Зайди под учеником, начни attempt теста с 5 вопросами и time limit 2 минуты.
2. Ответь на 3 из 5 вопросов разными типами. Не нажимай submit.
3. Подожди истечения таймера — должен сработать авто-submit (через worker cron).
4. На странице result — оценка корректная, неотвеченные вопросы = 0 баллов.
5. Начни новую попытку, пройди до конца, submit вручную → result показывается с feedback по политике.

```bash
pnpm --filter web typecheck
pnpm --filter web build
```

**Коммит:**

```
feat(quiz): student quiz-taking ui with timer, auto-save and per-type views
```

---

## Шаг 7 — `Assignment` и `AssignmentSubmission`

**Цель:** учитель даёт письменное задание, ученик отправляет решение (текст и/или файлы), учитель проверяет руками.

**Что сделать:**

1. Prisma schema:
   ```prisma
   enum AssignmentSubmissionType { TEXT  FILES  BOTH }
   enum AssignmentStatus { DRAFT  PUBLISHED  ARCHIVED }
   enum SubmissionState { DRAFT  SUBMITTED  GRADED  RETURNED_FOR_REVISION }

   model Assignment {
     id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId            String   @db.Uuid
     courseId            String   @db.Uuid
     course              Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
     title               String
     instructions        Json                                     // TipTap
     submissionType      AssignmentSubmissionType
     maxScore            Float    @default(100)
     dueDate             DateTime?
     allowLateSubmission Boolean  @default(true)
     latePenaltyPerDay   Float    @default(0)                     // процент за день просрочки
     rubric              Json?                                    // { criteria: [{ id, name, maxPoints, levels: [{id, label, points, description}] }] }
     status              AssignmentStatus @default(DRAFT)
     publishedAt         DateTime?
     createdById         String   @db.Uuid
     createdAt           DateTime @default(now())
     updatedAt           DateTime @updatedAt
     submissions         AssignmentSubmission[]
     @@index([schoolId])
     @@index([courseId])
   }

   model AssignmentSubmission {
     id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     schoolId      String   @db.Uuid
     assignmentId  String   @db.Uuid
     assignment    Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
     userId        String   @db.Uuid
     user          User     @relation(fields: [userId], references: [id])
     textContent   Json?                                          // TipTap
     fileAssetIds  String[]  @default([])  @db.Uuid               // массив FileAsset.id
     submittedAt   DateTime?
     isLate        Boolean  @default(false)
     state         SubmissionState @default(DRAFT)
     score         Float?
     gradedAt      DateTime?
     graderId      String?  @db.Uuid
     graderFeedback Json?                                         // TipTap
     rubricScores  Json?                                          // { [criterionId]: { levelId, points, comment? } }
     @@unique([assignmentId, userId])
     @@index([userId])
     @@index([assignmentId, state])
   }
   ```
   Миграция.
2. tRPC роутер `assignment.ts`:
   - `list({courseId})`, `byId`, `create`, `update`, `delete`, `publish`, `archive`.
3. tRPC роутер `submission.ts`:
   - `mySubmission({assignmentId})` — для ученика.
   - `saveDraft({assignmentId, textContent?, fileAssetIds?})` — upsert в state DRAFT.
   - `submit({assignmentId})` — переводит DRAFT → SUBMITTED, проставляет submittedAt, isLate.
   - `listForGrading({assignmentId, filters?})` — для учителя, с фильтрами по state.
4. UI учителя:
   - `/courses/[id]/edit/assignments` — список.
   - `/courses/[id]/edit/assignments/[assignmentId]` — редактор:
     - Поля: title, submissionType, dueDate, maxScore, allowLate, latePenalty.
     - **Instructions** — TipTap editor с поддержкой загрузки картинок.
     - **Rubric builder** — отдельный компонент, см. шаг 8.
     - Кнопки «Опубликовать»/«Снять с публикации».
   - Блок ACTIVITY_REFERENCE в редакторе урока умеет ссылаться и на Quiz, и на Assignment.
5. UI ученика:
   - `/learn/[courseId]/assignment/[assignmentId]` — страница задания:
     - Метаданные + instructions.
     - Форма submission:
       - TextContent (если submissionType TEXT/BOTH) — TipTap editor.
       - FileUpload (если submissionType FILES/BOTH) — multi-file через `<FileUpload>` (Phase 1 компонент), список загруженных с возможностью удалить.
     - Кнопки «Сохранить черновик», «Отправить на проверку».
     - Auto-save черновика каждые 30 сек.
     - Под формой — история своих submissions (если RETURNED_FOR_REVISION — комментарий учителя).

**Проверка:**

Ручная:
1. Учитель создаёт Assignment «Эссе на тему X», submissionType=BOTH, dueDate через 7 дней.
2. Учитель опубликовал.
3. Ученик открывает, пишет текст, загружает PDF, сохраняет черновик.
4. Возвращается через час — черновик восстановлен.
5. Submit → state=SUBMITTED, в Prisma Studio submittedAt установлен.

```bash
pnpm --filter web typecheck
pnpm --filter @parta5/db exec prisma migrate dev --name assignments
```

**Коммит:**

```
feat(assignment): add Assignment and Submission models with text+files
```

---

## Шаг 8 — ручная оценка assignment с рубриками

**Цель:** учитель эффективно проверяет работы — по рубрике, с комментариями, может вернуть на доработку.

**Что сделать:**

1. **Rubric builder** компонент `apps/web/components/rubric-builder.tsx`:
   - Список критериев. Каждый критерий — name, maxPoints + список уровней (например: «отлично» 4 балла, «хорошо» 3, «удовлетворительно» 2, «нужна доработка» 1, «не зачтено» 0).
   - Кнопка «Добавить критерий», «Добавить уровень».
   - Drag-and-drop порядка.
   - Превью рубрики (table) внизу.
2. UI учителя — проверка submissions:
   - `/courses/[id]/edit/assignments/[assignmentId]/submissions` — таблица всех submission'ов:
     - Колонки: ученик, state, submittedAt, isLate, score (если оценено), кнопки «Открыть».
     - Фильтры: state, ученик search, дата.
   - `/courses/[id]/edit/assignments/[assignmentId]/submissions/[submissionId]` — страница оценки:
     - Слева: submission ученика (textContent rendered + список файлов с кнопками открыть/скачать).
     - Справа: рубрика (если есть) — на каждом критерии select уровня, опциональный comment. Под рубрикой — общий feedback (TipTap), итоговый score (авто = сумма rubricScores, можно вручную переопределить).
     - Кнопки: «Сохранить оценку», «Сохранить и вернуть на доработку», «Сохранить и закрыть».
3. tRPC `submission.grade({submissionId, rubricScores?, score?, graderFeedback?, action: 'final'|'return'})`:
   - `final` → state=GRADED, gradedAt=now, graderId=current.
   - `return` → state=RETURNED_FOR_REVISION, gradedAt=now, graderFeedback обязателен.
4. Ученик видит результат на странице задания:
   - Если GRADED → score, рубрика с оценками по критериям, graderFeedback.
   - Если RETURNED_FOR_REVISION → комментарий учителя + возможность снова submit (новая submission переходит в DRAFT, history сохраняется).
5. Уведомления (минимально):
   - Учитель → ученик: «Ваша работа проверена» (через `Notification` модель — создай её в этом шаге если не было: `{id, schoolId, userId, type, payload (Json), readAt?, createdAt}`).
   - Учитель → ученик: «Работа возвращена на доработку».
   - Ученик → учитель: «Новая submission в задании X».
   - Реальную доставку email/Telegram — Phase 4. Сейчас только запись в БД и dropdown в header «N новых уведомлений».

**Проверка:**

Ручная:
1. Учитель: открывает submission, заполняет рубрику (3 критерия), общий feedback, сохраняет → state=GRADED.
2. Ученик видит: score, рубрика, feedback.
3. Учитель: возвращает другую submission на доработку. Ученик видит уведомление, возвращается, дополняет, submit.
4. Цикл повторяется до GRADED.

```bash
pnpm --filter web typecheck
pnpm --filter @parta5/db exec prisma migrate dev --name notifications
```

**Коммит:**

```
feat(assignment): rubric-based manual grading with revisions and notifications
```

---

## Шаг 9 — Gradebook

**Цель:** учитель видит общую картину успеваемости класса.

**Что сделать:**

1. Страница `/courses/[id]/grades` (только для TEACHER+):
   - Таблица: строки — ученики (через Enrollment с role=STUDENT), колонки — активности (все опубликованные Quiz + Assignment курса, в порядке создания), последняя колонка — итоговая.
   - Каждая ячейка:
     - Для Quiz: лучшая оценка по попыткам (или средняя — настройка курса, по дефолту best).
     - Для Assignment: оценка GRADED submission (если нет — прочерк).
     - Клик → ссылка на конкретный attempt/submission.
   - Итоговая колонка: средний процент по всем активностям (с весом). На Phase 2 — простое среднее, веса всех активностей = 1. (Расширенные формулы — Phase 4+.)
   - Sort by name / by total / by активность.
   - Кнопка «Экспорт в CSV».
2. `gradebook.csv` endpoint (server action или tRPC `gradebook.export`):
   - Колонки: «Ученик», «Email», для каждой активности — «Балл», «Макс», «%», в конце — «Итого %».
   - UTF-8 with BOM (для Excel), `;` разделитель (русская локаль).
3. Страница `/learn/[courseId]/grades` для ученика — его собственная строка из gradebook (без других учеников).
4. tRPC `gradebook.byCourse({courseId})` — вычисляет таблицу. Aggregate query (1 SQL) — не делай N+1.

**Проверка:**

Ручная:
1. 3 ученика на курсе, в курсе 2 quiz + 1 assignment.
2. Ученики проходят quiz/assignment, учитель проверяет.
3. На `/courses/[id]/grades` — корректная таблица.
4. Экспорт в CSV — открывается в Excel без проблем с кодировкой.

```bash
pnpm --filter web typecheck
pnpm --filter web test
```

**Коммит:**

```
feat(gradebook): per-course grade book with csv export
```

---

## Шаг 10 — демо-курс с тестами и заданиями + e2e

**Цель:** реалистичный демо-сценарий + покрытие тестами.

**Что сделать:**

1. Расширь `packages/db/prisma/seed.ts`:
   - В курсе «Введение в бег для начинающих» добавь:
     - В уроке «Зачем бегать» — Quiz «Проверка понимания» с 5 вопросами:
       1. SINGLE_CHOICE: «Сколько раз в неделю оптимально бегать новичку?» (варианты: 1, 3, 5, каждый день — правильный 3).
       2. MULTIPLE_CHOICE: «Какие преимущества даёт бег?» (укрепление сердца ✓, рост мышц ✓, улучшение настроения ✓, увеличение роста ✗).
       3. TRUE_FALSE: «Перед бегом обязательно нужна разминка.» (true).
       4. NUMERIC: «Оптимальный пульс при беге для возраста 30 лет (макс ЧСС × 0.7)?» (correctValue: 133, tolerance: 5).
       5. ESSAY: «Опишите, почему вы решили начать бегать (50-150 слов).» (minWords: 50, maxWords: 150).
     - В уроке «Первая тренировка» — Assignment «План недели»:
       - Instructions (TipTap): инструкции с примером.
       - submissionType: TEXT.
       - dueDate: +7 дней от сидинга.
       - Rubric с 3 критериями (объём, реалистичность, структура), 4 уровня каждый.
     - Записать на курс 3 студентов из сида (студент@school1.test и двух дополнительных).
2. E2E тесты в `e2e/`:
   - `e2e/quiz-flow.spec.ts`:
     - Учитель создаёт quiz из 3 вопросов разных типов, публикует.
     - Ученик начинает attempt, отвечает, submit, видит результат.
     - Учитель видит attempt в списке.
   - `e2e/assignment-flow.spec.ts`:
     - Учитель создаёт assignment с рубрикой, публикует.
     - Ученик отправляет text + file.
     - Учитель проверяет по рубрике, ставит оценку.
     - Ученик видит результат.
   - `e2e/quiz-timer.spec.ts` (помечен `@slow` — только локально):
     - Quiz с timeLimit 30 сек, fake timer Playwright, проверка auto-submit.
   - `e2e/gradebook.spec.ts`:
     - Два ученика прошли quiz и assignment, gradebook показывает корректные данные.
     - Экспорт CSV — проверка содержимого.
3. Обнови `README.md`:
   - Скриншот квиза, assignment, gradebook.
   - Раздел «Что нового в Phase 2» с маркированным списком.
4. Обнови `00-parta5.md`:
   - Phase 2 → `[x]`.
   - Статус → Phase 3 (импорт из Moodle).
   - Чек-лист на следующее: получить `.mbz` файл от Paul (свой Moodle тест-курс или demo).

**Проверка:**

```bash
pnpm --filter @parta5/db exec prisma migrate reset --force
pnpm --filter @parta5/db exec prisma db seed
pnpm --filter web build
pnpm --filter web start &
sleep 5

# E2E без slow
pnpm exec playwright test --grep-invert=@slow --reporter=list

kill %1
```

**Коммит:**

```
test(e2e): quiz, assignment and gradebook end-to-end + rich demo content
```

---

## Финал Phase 2

После завершения шага 10:

1. Обнови `00-parta5.md`: Phase 2 → `[x]`, статус → Phase 3.
2. Создай тэг: `git tag -a v0.3.0-phase2 -m "Phase 2 complete: 8 question types, quiz attempts, assignments with rubrics, gradebook"`.
3. Push на GitHub и GitFlic.
4. Сообщи Paul: **«Phase 2 закрыт. Платформа умеет автопроверяемые тесты на 8 типов вопросов, задания с рубриками и журнал оценок. Готово к Phase 3 — импорту курсов из Moodle. Нужен реальный .mbz файл для разработки и тестирования импортёра.»**

## Что Phase 2 НЕ покрывает

- Импорт банков вопросов из Moodle XML / GIFT / QTI (Phase 3).
- Random quiz pools (Quiz берёт N случайных из банка при каждом attempt) — есть `bulkAddFromBank` но без рандомизации per-attempt.
- Прокторинг, lockdown browser, anti-cheat (никогда в ядре — только в платных модулях, если вообще).
- Адаптивное тестирование (CAT — вопрос подбирается под уровень).
- Peer-review (ученик оценивает работу другого ученика) — это Moodle Workshop, мы его отложили.
- Sertification / badges (Phase 4+).
- Расширенные формулы итоговых оценок (взвешенные категории, drop lowest, etc.) — Phase 4.
- Математические формулы в вопросах через KaTeX (Phase 5).

Если Paul просит из этого списка прямо сейчас — НЕ соглашайся, отложи в backlog.

---

## Если что-то пошло сильно не так

- `git restore .`
- `git reset --hard HEAD~1`
- `pnpm --filter @parta5/db exec prisma migrate reset --force` (локально)
- `docker compose down -v && docker compose up -d`
- Спроси Paul, не выдумывай.

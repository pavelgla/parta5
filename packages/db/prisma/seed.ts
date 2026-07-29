import {
  PrismaClient,
  UserRole,
  CourseStatus,
  ContentBlockType,
  EnrollmentRole,
  QuestionType,
  Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password', 12);

  // ── School 1 (base test school) ────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { slug: 'school-1' },
    update: {},
    create: { slug: 'school-1', name: 'Тестовая школа №1' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@school1.test' },
    update: {},
    create: {
      email: 'admin@school1.test',
      hashedPassword,
      name: 'Администратор',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'teacher@school1.test' },
    update: {},
    create: {
      email: 'teacher@school1.test',
      hashedPassword,
      name: 'Учитель',
      role: UserRole.TEACHER,
      schoolId: school.id,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@school1.test' },
    update: {},
    create: {
      email: 'student@school1.test',
      hashedPassword,
      name: 'Ученик',
      role: UserRole.STUDENT,
      schoolId: school.id,
    },
  });

  await prisma.course.upsert({
    where: { schoolId_slug: { schoolId: school.id, slug: 'intro-course' } },
    update: {},
    create: {
      schoolId: school.id,
      slug: 'intro-course',
      title: 'Вводный курс',
      description: 'Тестовый черновик курса для разработки',
      status: CourseStatus.DRAFT,
      createdById: admin.id,
    },
  });

  // ── School RunStart (demo school) ──────────────────────────────────────────
  const runstart = await prisma.school.upsert({
    where: { slug: 'runstart' },
    update: {},
    create: { slug: 'runstart', name: 'RunStart — школа бега', kind: 'SCHOOL' },
  });

  const rsTeacher = await prisma.user.upsert({
    where: { email: 'teacher@runstart.test' },
    update: {},
    create: {
      email: 'teacher@runstart.test',
      hashedPassword,
      name: 'Ирина Беляева',
      role: UserRole.TEACHER,
      schoolId: runstart.id,
    },
  });

  const rsStudent = await prisma.user.upsert({
    where: { email: 'student@runstart.test' },
    update: {},
    create: {
      email: 'student@runstart.test',
      hashedPassword,
      name: 'Артём Новиков',
      role: UserRole.STUDENT,
      schoolId: runstart.id,
    },
  });

  // ── Demo course ────────────────────────────────────────────────────────────
  const demoCourse = await prisma.course.upsert({
    where: { schoolId_slug: { schoolId: runstart.id, slug: 'intro-to-running' } },
    update: {},
    create: {
      schoolId: runstart.id,
      slug: 'intro-to-running',
      title: 'Введение в бег для начинающих',
      status: CourseStatus.PUBLISHED,
      publishedAt: new Date(),
      subject: 'pe',
      gradeLevel: 7,
      shortDescription: 'Базовый курс для тех, кто хочет начать бегать с нуля',
      longDescription: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Этот курс разработан специально для тех, кто никогда не бегал или делал это нерегулярно. Мы начнём с основ: зачем бегать, как правильно дышать, какую обувь выбрать и как избежать травм.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'По завершении курса вы будете готовы к своей первой тренировке и сможете пробежать 2 километра без остановки. Каждый урок содержит видео, упражнения и практические советы.',
              },
            ],
          },
        ],
      },
      createdById: rsTeacher.id,
    },
  });

  // Enroll student
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: demoCourse.id, userId: rsStudent.id } },
    update: {},
    create: {
      courseId: demoCourse.id,
      userId: rsStudent.id,
      role: EnrollmentRole.STUDENT,
    },
  });

  // Also enroll school-1 student for cross-school demo (e2e convenience)
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: demoCourse.id, userId: student.id } },
    update: {},
    create: {
      courseId: demoCourse.id,
      userId: student.id,
      role: EnrollmentRole.STUDENT,
    },
  });

  // ── Modules ────────────────────────────────────────────────────────────────
  type ModuleDef = {
    title: string;
    order: number;
    lessons: LessonDef[];
  };

  type LessonDef = {
    title: string;
    order: number;
    blocks: BlockDef[];
  };

  type BlockDef = {
    type: ContentBlockType;
    data: Prisma.InputJsonValue;
    order: number;
  };

  const modulesData: ModuleDef[] = [
    {
      title: 'Модуль 1: Зачем бегать',
      order: 1,
      lessons: [
        {
          title: 'Польза бега для здоровья',
          order: 1,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Почему бег — лучший старт' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Бег — одна из самых доступных форм аэробной нагрузки. Для него не нужен тренажёрный зал или специальное оборудование: достаточно пары кроссовок и желания.</p>',
                text: 'Бег — одна из самых доступных форм аэробной нагрузки.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'info',
                text: '30 минут бега три раза в неделю снижают риск сердечно-сосудистых заболеваний на 35% — данные ВОЗ 2023 года.',
              },
              order: 3,
            },
            {
              type: ContentBlockType.VIDEO_EMBED,
              data: {
                provider: 'youtube',
                url: 'https://www.youtube.com/watch?v=kVnyY17VS9Y',
                embedUrl: 'https://www.youtube.com/embed/kVnyY17VS9Y',
                providerVideoId: 'kVnyY17VS9Y',
              },
              order: 4,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 5,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Регулярные пробежки улучшают сон, снижают стресс и укрепляют суставы. Главное — начать постепенно и не травмировать себя на старте.</p>',
                text: 'Регулярные пробежки улучшают сон, снижают стресс и укрепляют суставы.',
              },
              order: 6,
            },
          ],
        },
        {
          title: 'Мотивация и постановка целей',
          order: 2,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Поставь цель — беги к ней' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Цель должна быть конкретной и измеримой. Не «хочу бегать», а «хочу пробежать 5 км без остановки через 8 недель».</p>',
                text: 'Цель должна быть конкретной и измеримой.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'warning',
                text: 'Не ставь цель «похудеть на X кг за месяц» — это ведёт к перегрузкам и разочарованиям. Фокусируйся на дистанции и регулярности.',
              },
              order: 3,
            },
            {
              type: ContentBlockType.VIDEO_EMBED,
              data: {
                provider: 'youtube',
                url: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
                embedUrl: 'https://www.youtube.com/embed/oHg5SJYRHA0',
                providerVideoId: 'oHg5SJYRHA0',
              },
              order: 4,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 5,
            },
          ],
        },
        {
          title: 'Выбор экипировки',
          order: 3,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Кроссовки, одежда, гаджеты' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Главная инвестиция — беговые кроссовки с правильной амортизацией. Обувь подбирают с учётом типа стопы: нейтральная, пронирующая или супинирующая.</p>',
                text: 'Главная инвестиция — беговые кроссовки с правильной амортизацией.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'info',
                text: 'Хорошие беговые кроссовки можно найти от 3 000 ₽. Не нужно сразу покупать премиум-модели — начни с mid-range и посмотри, как откликается тело.',
              },
              order: 3,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 4,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Одежда — влагоотводящая. Хлопок не подходит: он намокает и натирает. Из гаджетов на старте достаточно обычных часов или смартфона с приложением.</p>',
                text: 'Одежда — влагоотводящая. Хлопок не подходит.',
              },
              order: 5,
            },
          ],
        },
      ],
    },
    {
      title: 'Модуль 2: Техника бега',
      order: 2,
      lessons: [
        {
          title: 'Правильная постановка стопы',
          order: 1,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Как ставить стопу при беге' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Существует три типа постановки: пяточный, средний и носочный. Для начинающих рекомендуется средний — он снижает ударную нагрузку на колени и тазобедренный сустав.</p>',
                text: 'Существует три типа постановки: пяточный, средний и носочный.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.VIDEO_EMBED,
              data: {
                provider: 'youtube',
                url: 'https://www.youtube.com/watch?v=kVnyY17VS9Y',
                embedUrl: 'https://www.youtube.com/embed/kVnyY17VS9Y',
                providerVideoId: 'kVnyY17VS9Y',
              },
              order: 3,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'warning',
                text: 'Не пытайся сразу переучиться с пяточного бега на носочный — это увеличивает нагрузку на икры и ахилл. Переход занимает 2–3 месяца постепенной адаптации.',
              },
              order: 4,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 5,
            },
          ],
        },
        {
          title: 'Дыхание и каденс',
          order: 2,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Дышим правильно, бежим в ритм' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Оптимальный каденс для начинающих — 160–170 шагов в минуту. Слишком длинный шаг увеличивает нагрузку; короткий и частый шаг — более экономичен.</p>',
                text: 'Оптимальный каденс для начинающих — 160–170 шагов в минуту.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Дышать нужно через нос и рот одновременно. Если не можешь говорить фразами — замедлись: ты бежишь слишком быстро для своего текущего уровня.</p>',
                text: 'Дышать нужно через нос и рот одновременно.',
              },
              order: 3,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'info',
                text: 'Разговорный темп — главный индикатор аэробной зоны. Если можешь разговаривать — темп правильный.',
              },
              order: 4,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 5,
            },
          ],
        },
      ],
    },
    {
      title: 'Модуль 3: Первая тренировка',
      order: 3,
      lessons: [
        {
          title: 'Разминка перед бегом',
          order: 1,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Разминка: 5–10 минут' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Разминка разогревает мышцы и суставы, снижая риск растяжений. Включает динамическую растяжку, круговые движения суставами и лёгкую ходьбу.</p>',
                text: 'Разминка разогревает мышцы и суставы.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.VIDEO_EMBED,
              data: {
                provider: 'youtube',
                url: 'https://www.youtube.com/watch?v=kVnyY17VS9Y',
                embedUrl: 'https://www.youtube.com/embed/kVnyY17VS9Y',
                providerVideoId: 'kVnyY17VS9Y',
              },
              order: 3,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'warning',
                text: 'Никогда не начинай пробежку без разминки — особенно в холодную погоду. Это главная причина травм у начинающих.',
              },
              order: 4,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 5,
            },
          ],
        },
        {
          title: 'Первая интервальная тренировка',
          order: 2,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Бег-ходьба: протокол для нулевого уровня' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Метод «бег-ходьба» разработал тренер Джефф Гэллоуэй. Суть: чередуй 1 минуту бега и 2 минуты ходьбы. Повтори 8–10 раз.</p>',
                text: 'Метод «бег-ходьба» разработал тренер Джефф Гэллоуэй.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'info',
                text: 'После первой тренировки лёгкая боль в мышцах — норма. Острая боль в суставах — сигнал остановиться и обратиться к врачу.',
              },
              order: 3,
            },
            {
              type: ContentBlockType.VIDEO_EMBED,
              data: {
                provider: 'youtube',
                url: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
                embedUrl: 'https://www.youtube.com/embed/oHg5SJYRHA0',
                providerVideoId: 'oHg5SJYRHA0',
              },
              order: 4,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 5,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Поздравляем! Ты прошёл базовый курс. Продолжай по программе 3 тренировки в неделю — и через 8 недель преодолеешь свои первые 5 км.</p>',
                text: 'Поздравляем! Ты прошёл базовый курс.',
              },
              order: 6,
            },
          ],
        },
        {
          title: 'Заминка и восстановление',
          order: 3,
          blocks: [
            {
              type: ContentBlockType.HEADING,
              data: { level: 2, text: 'Завершение тренировки' },
              order: 1,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Заминка — 5–10 минут лёгкой ходьбы плюс статическая растяжка. Растягивай икры, квадрицепсы и подколенные сухожилия по 30–60 секунд.</p>',
                text: 'Заминка — 5–10 минут лёгкой ходьбы плюс статическая растяжка.',
              },
              order: 2,
            },
            {
              type: ContentBlockType.CALLOUT,
              data: {
                variant: 'info',
                text: 'Пей воду после тренировки: минимум 400–600 мл. В жаркую погоду — больше, и добавь электролиты.',
              },
              order: 3,
            },
            {
              type: ContentBlockType.DIVIDER,
              data: {},
              order: 4,
            },
            {
              type: ContentBlockType.TEXT,
              data: {
                html: '<p>Следующая тренировка — не ранее чем через 48 часов. Мышцам нужно время на восстановление.</p>',
                text: 'Следующая тренировка — не ранее чем через 48 часов.',
              },
              order: 5,
            },
          ],
        },
      ],
    },
  ];

  let firstLessonId: string | null = null;

  for (const modDef of modulesData) {
    const existingMod = await prisma.module.findFirst({
      where: { courseId: demoCourse.id, order: modDef.order },
    });

    const mod = existingMod
      ? existingMod
      : await prisma.module.create({
          data: {
            courseId: demoCourse.id,
            schoolId: runstart.id,
            title: modDef.title,
            order: modDef.order,
          },
        });

    for (const lessDef of modDef.lessons) {
      const existingLesson = await prisma.lesson.findFirst({
        where: { moduleId: mod.id, order: lessDef.order },
      });

      const lesson = existingLesson
        ? existingLesson
        : await prisma.lesson.create({
            data: {
              moduleId: mod.id,
              schoolId: runstart.id,
              title: lessDef.title,
              order: lessDef.order,
            },
          });

      const existingBlocks = await prisma.contentBlock.count({
        where: { lessonId: lesson.id },
      });

      if (existingBlocks === 0) {
        await prisma.contentBlock.createMany({
          data: lessDef.blocks.map((b) => ({
            lessonId: lesson.id,
            schoolId: runstart.id,
            type: b.type,
            data: b.data,
            order: b.order,
          })),
        });
      }

      if (modDef.order === 1 && lessDef.order === 1) {
        firstLessonId = lesson.id;
      }
    }
  }

  // ── Demo quiz: question bank + questions + quiz ───────────────────────────
  const runningBank =
    (await prisma.questionBank.findFirst({
      where: { schoolId: runstart.id, name: 'Основы бега' },
    })) ??
    (await prisma.questionBank.create({
      data: {
        schoolId: runstart.id,
        name: 'Основы бега',
        createdById: rsTeacher.id,
      },
    }));

  type QuestionDef = {
    name: string;
    type: QuestionType;
    points: number;
    data: Prisma.InputJsonValue;
  };

  const questionDefs: QuestionDef[] = [
    {
      name: 'Правильная постановка стопы',
      type: QuestionType.MULTICHOICE,
      points: 2,
      data: {
        type: 'MULTICHOICE',
        prompt: '<p>Какая постановка стопы <strong>рекомендуется</strong> начинающим?</p>',
        single: true,
        shuffleChoices: false,
        choices: [
          { id: 'a', text: 'Пяточная', correct: false },
          {
            id: 'b',
            text: 'Средняя (на свод стопы)',
            correct: true,
            feedback:
              'Верно — средняя постановка снижает ударную нагрузку на колени и тазобедренный сустав.',
          },
          { id: 'c', text: 'Носочная', correct: false },
          { id: 'd', text: 'Любая, разницы нет', correct: false },
        ],
        defaultPoints: 2,
      },
    },
    {
      name: 'Пульсовые зоны',
      type: QuestionType.MULTICHOICE,
      points: 2,
      data: {
        type: 'MULTICHOICE',
        prompt: 'Как понять, что вы бежите в комфортном аэробном темпе?',
        single: true,
        shuffleChoices: false,
        choices: [
          {
            id: 'a',
            text: 'Вы можете разговаривать фразами, не задыхаясь',
            correct: true,
            feedback: 'Верно — разговорный темп — главный индикатор аэробной зоны.',
          },
          { id: 'b', text: 'Пульс выше 90% от максимального', correct: false },
          { id: 'c', text: 'Вы задыхаетесь через 30 секунд бега', correct: false },
          { id: 'd', text: 'Скорость выше 15 км/ч', correct: false },
        ],
        defaultPoints: 2,
      },
    },
    {
      name: 'Экипировка для зимней пробежки',
      type: QuestionType.MULTICHOICE,
      points: 2,
      data: {
        type: 'MULTICHOICE',
        prompt: 'Что стоит взять с собой на зимнюю пробежку? (выберите два варианта)',
        single: false,
        shuffleChoices: false,
        choices: [
          { id: 'a', text: 'Влагоотводящее термобельё', correct: true },
          { id: 'b', text: 'Хлопковую футболку', correct: false },
          { id: 'c', text: 'Перчатки или варежки', correct: true },
          { id: 'd', text: 'Солнцезащитные очки категории 4', correct: false },
        ],
        defaultPoints: 2,
      },
    },
    {
      name: 'Разминка перед бегом обязательна',
      type: QuestionType.TRUEFALSE,
      points: 2,
      data: {
        type: 'TRUEFALSE',
        prompt: 'Разминка перед пробежкой обязательна, особенно в холодную погоду.',
        correctAnswer: true,
        defaultPoints: 2,
      },
    },
    {
      name: 'Минимальная длительность разминки',
      type: QuestionType.SHORTANSWER,
      points: 2,
      data: {
        type: 'SHORTANSWER',
        prompt: 'Сколько минут должна длиться разминка перед бегом как минимум?',
        acceptedAnswers: ['10', 'десять'],
        caseSensitive: false,
        defaultPoints: 2,
      },
    },
  ];

  const questions = [];
  for (const qDef of questionDefs) {
    const question =
      (await prisma.question.findFirst({
        where: { bankId: runningBank.id, name: qDef.name },
      })) ??
      (await prisma.question.create({
        data: {
          schoolId: runstart.id,
          bankId: runningBank.id,
          type: qDef.type,
          name: qDef.name,
          data: qDef.data,
          createdById: rsTeacher.id,
        },
      }));
    questions.push({ question, points: qDef.points });
  }

  const quiz =
    (await prisma.quiz.findFirst({
      where: { schoolId: runstart.id, title: 'Проверка знаний: основы бега' },
    })) ??
    (await prisma.quiz.create({
      data: {
        schoolId: runstart.id,
        title: 'Проверка знаний: основы бега',
        // "Порог сдачи (%)" в UI на деле сравнивается напрямую с суммой баллов
        // (см. quiz-player.tsx), поэтому 60% от 10 максимальных баллов = 6.
        passingScore: 60,
        maxAttempts: 3,
        timeLimitSeconds: 600,
        createdById: rsTeacher.id,
      },
    }));

  for (const [i, { question, points }] of questions.entries()) {
    const order = i + 1;
    const existingQuizQuestion = await prisma.quizQuestion.findUnique({
      where: { quizId_questionId: { quizId: quiz.id, questionId: question.id } },
    });

    if (!existingQuizQuestion) {
      await prisma.quizQuestion.create({
        data: {
          schoolId: runstart.id,
          quizId: quiz.id,
          questionId: question.id,
          order,
          points,
        },
      });
    }
  }

  if (firstLessonId) {
    const existingQuizBlock = await prisma.contentBlock.findFirst({
      where: { lessonId: firstLessonId, type: ContentBlockType.QUIZ },
    });

    if (!existingQuizBlock) {
      const maxOrder = await prisma.contentBlock.aggregate({
        where: { lessonId: firstLessonId },
        _max: { order: true },
      });

      await prisma.contentBlock.create({
        data: {
          lessonId: firstLessonId,
          schoolId: runstart.id,
          type: ContentBlockType.QUIZ,
          data: { quizId: quiz.id, title: quiz.title },
          order: (maxOrder._max.order ?? 0) + 1,
        },
      });
    }
  }

  // ── Demo group (RunStart) ──────────────────────────────────────────────────
  const runstartGroup = await prisma.group.upsert({
    where: { schoolId_name: { schoolId: runstart.id, name: 'Группа 1' } },
    update: {},
    create: {
      schoolId: runstart.id,
      name: 'Группа 1',
    },
  });

  await prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId: runstartGroup.id, userId: rsStudent.id } },
    update: {},
    create: {
      schoolId: runstart.id,
      groupId: runstartGroup.id,
      userId: rsStudent.id,
    },
  });

  console.log(
    'Seed complete: 2 schools, 5 users, 2 courses, 3 modules, 8 lessons, ~40 blocks, 1 quiz, 1 group',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

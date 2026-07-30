import { SchoolKind } from '@parta5/db';

export type ValidationIssue = { path: string; message: string };

export type CourseForValidation = {
  title: string;
  shortDescription?: string | null;
  subject?: string | null;
  gradeLevel?: number | null;
  coverFileAssetId?: string | null;
  modules: Array<{
    id: string;
    title: string;
    lessons: Array<{
      id: string;
      title: string;
      blocks: Array<{ id: string }>;
    }>;
  }>;
};

export function validateCourse(course: CourseForValidation, kind: SchoolKind): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!course.title?.trim()) {
    issues.push({ path: 'title', message: 'Укажите название курса' });
  }
  if (kind === SchoolKind.SCHOOL) {
    if (!course.shortDescription?.trim()) {
      issues.push({ path: 'shortDescription', message: 'Краткое описание обязательно' });
    }
    if (!course.subject) {
      issues.push({ path: 'subject', message: 'Выберите предмет' });
    }
    if (!course.gradeLevel || course.gradeLevel < 5 || course.gradeLevel > 11) {
      issues.push({ path: 'gradeLevel', message: 'Укажите класс (5–11)' });
    }
    if (!course.coverFileAssetId) {
      issues.push({ path: 'cover', message: 'Загрузите обложку курса' });
    }
  } else if (course.gradeLevel != null && (course.gradeLevel < 5 || course.gradeLevel > 11)) {
    issues.push({ path: 'gradeLevel', message: 'Укажите класс (5–11)' });
  }
  if (course.modules.length === 0) {
    issues.push({ path: 'modules', message: 'Добавьте хотя бы один модуль' });
  } else if (course.modules.every((mod) => mod.lessons.length === 0)) {
    // Пустой модуль сам по себе публикацию не блокирует: в Moodle-курсах
    // сплошь встречаются заготовки разделов («Topic 2», «Topic 3») без
    // содержимого, и такие курсы там доступны слушателям. Требуем лишь,
    // чтобы хотя бы один модуль содержал уроки.
    issues.push({ path: 'modules', message: 'Ни один модуль не содержит уроков' });
  }
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.blocks.length === 0) {
        issues.push({
          path: `lesson.${lesson.id}.blocks`,
          message: `Урок «${lesson.title}» пустой`,
        });
      }
    }
  }

  return issues;
}

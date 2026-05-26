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
  { id: 'art', label: 'ИЗО' },
  { id: 'music', label: 'Музыка' },
  { id: 'technology', label: 'Технология' },
  { id: 'other', label: 'Другое' },
] as const;

export type SubjectId = (typeof SCHOOL_SUBJECTS)[number]['id'];
export const SUBJECT_IDS = SCHOOL_SUBJECTS.map((s) => s.id) as [SubjectId, ...SubjectId[]];

export interface SkippedActivity {
  modulename: string;
  title: string;
  reason: string;
}

export interface ImportReport {
  courseTitle: string;
  courseSlug: string | null;
  modules: number;
  skippedEmptySections: number;
  lessons: number;
  blocks: number;
  files: { count: number; totalBytes: number };
  questionFiles: { count: number; totalBytes: number };
  skippedActivities: SkippedActivity[];
  warnings: string[];
  quizzes: number;
  questions: { imported: number; skippedByType: Record<string, number> };
  courseCover: boolean;
}

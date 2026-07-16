import type { QuestionData } from '@parta5/quiz';

export interface ParsedQuestion {
  name: string;
  data: QuestionData;
  hasPluginFiles: boolean;
  pluginFileNames: string[];
  rawPromptHtml: string;
}

export interface SkippedQuestion {
  name: string;
  moodleType: string;
  reason: string;
}

export interface QuestionParseResult {
  questions: ParsedQuestion[];
  skipped: SkippedQuestion[];
}

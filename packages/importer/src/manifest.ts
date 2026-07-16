import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createXmlParser } from './xml.js';
import { z } from 'zod';

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

export const manifestActivity = z.object({
  moduleId: z.coerce.number(),
  sectionId: z.coerce.number(),
  modulename: z.string(),
  title: z.string(),
  directory: z.string(),
});

export const manifestSection = z.object({
  sectionId: z.coerce.number(),
  title: z.string(),
  directory: z.string(),
});

export const courseManifest = z.object({
  moodleVersion: z.string(),
  moodleRelease: z.string(),
  backupDate: z.coerce.number(),
  originalCourseFullname: z.string(),
  originalCourseShortname: z.string(),
  sections: z.array(manifestSection),
  activities: z.array(manifestActivity),
});

export type ManifestActivity = z.infer<typeof manifestActivity>;
export type ManifestSection = z.infer<typeof manifestSection>;
export type CourseManifest = z.infer<typeof courseManifest>;

export async function parseManifest(backupDir: string): Promise<CourseManifest> {
  const xmlPath = path.join(backupDir, 'moodle_backup.xml');
  const xml = await readFile(xmlPath, 'utf-8');
  const parser = createXmlParser();
  const parsed = parser.parse(xml);

  const root = parsed.moodle_backup;
  const information = root.information;
  const contents = information.contents;

  const rawSections = toArray(contents.sections?.section);
  const sections: ManifestSection[] = rawSections.map((section: Record<string, unknown>) =>
    manifestSection.parse({
      sectionId: section.sectionid,
      title: section.title,
      directory: section.directory,
    }),
  );

  const rawActivities = toArray(contents.activities?.activity);
  const activities: ManifestActivity[] = rawActivities.map((activity: Record<string, unknown>) =>
    manifestActivity.parse({
      moduleId: activity.moduleid,
      sectionId: activity.sectionid,
      modulename: activity.modulename,
      title: activity.title,
      directory: activity.directory,
    }),
  );

  return courseManifest.parse({
    moodleVersion: String(information.moodle_version),
    moodleRelease: String(information.moodle_release),
    backupDate: information.backup_date,
    originalCourseFullname: information.original_course_fullname,
    originalCourseShortname: information.original_course_shortname,
    sections,
    activities,
  });
}

export { toArray };

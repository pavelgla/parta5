import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

export async function getActivityContextId(
  backupDir: string,
  directory: string,
  modulename: string,
): Promise<number> {
  const parser = new XMLParser({ ignoreAttributes: false });

  const moduleXmlPath = path.join(backupDir, directory, 'module.xml');
  try {
    const xml = await readFile(moduleXmlPath, 'utf-8');
    const parsed = parser.parse(xml);
    const contextId = parsed.module?.contextid;
    if (contextId !== undefined) return Number(contextId);
  } catch {
    // module.xml missing — fall back to the activity xml's root attribute
  }

  const activityXmlPath = path.join(backupDir, directory, `${modulename}.xml`);
  const xml = await readFile(activityXmlPath, 'utf-8');
  const parsed = parser.parse(xml);
  return Number(parsed.activity['@_contextid']);
}

/**
 * Resolves a human-readable module (course section) title from Moodle backup data.
 *
 * Moodle stores an empty `name` for sections that use the default numbering —
 * the moodle_backup.xml manifest then already substitutes the raw section
 * number as the "title", which looks like a bare "0" once imported. We treat
 * the section.xml `name` field (which is genuinely nullable) as the source of
 * truth instead, and fall back to a Russian label derived from the section
 * number when no custom name was set.
 */
export function resolveModuleTitle(name: string | null, sectionNumber: number): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return sectionNumber === 0 ? 'Общее' : `Раздел ${sectionNumber}`;
}

/**
 * Some imported modules (notably from Moodle) end up with a junk `title`
 * such as an empty string or a bare number ("0", "12") — a leftover section
 * label that never carried real content. Falling back to "Раздел N" avoids
 * rendering nonsense like "Модуль 1 · 0" on the public course page.
 */
export function displayModuleTitle(title: string | null | undefined, index: number): string {
  const trimmed = title?.trim() ?? '';
  if (trimmed === '' || /^\d+$/.test(trimmed)) {
    return `Раздел ${index + 1}`;
  }
  return trimmed;
}

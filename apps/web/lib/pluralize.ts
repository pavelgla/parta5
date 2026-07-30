/**
 * Russian plural forms follow a 1 / 2–4 / 5–20 pattern (with the "many" form
 * also covering 11–14 regardless of the last digit): 1 урок, 2 урока,
 * 5 уроков, 11 уроков, 21 урок, 22 урока, 25 уроков.
 */
function pluralForm(count: number, [one, few, many]: [string, string, string]): string {
  const absCount = Math.abs(count);
  const mod10 = absCount % 10;
  const mod100 = absCount % 100;

  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** Formats a lesson count with the correct Russian plural form, e.g. "4 урока". */
export function pluralizeLessons(count: number): string {
  return `${count} ${pluralForm(count, ['урок', 'урока', 'уроков'])}`;
}

/** Formats a module count with the correct Russian plural form, e.g. "3 модуля". */
export function pluralizeModules(count: number): string {
  return `${count} ${pluralForm(count, ['модуль', 'модуля', 'модулей'])}`;
}

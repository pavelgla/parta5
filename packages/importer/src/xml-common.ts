const NULL_MARKER = '$@NULL@$';

export function nullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value);
  return str === NULL_MARKER ? null : str;
}

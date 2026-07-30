/**
 * Course descriptions are imported from Moodle and may contain arbitrary
 * HTML. The public storefront (landing, catalogue, course page) renders
 * them as plain text — no `dangerouslySetInnerHTML`, no new sanitizer
 * dependency, just tags stripped and a handful of common entities decoded.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  hellip: '…',
};

/** Strips HTML tags and decodes common named/numeric entities, collapsing whitespace. */
export function stripHtml(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, ' ');
  const decoded = withoutTags.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const codePoint = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
  return decoded.replace(/\s+/g, ' ').trim();
}

/** Truncates plain text to `maxLength` characters, adding an ellipsis if cut. */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

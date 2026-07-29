import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p',
  'br',
  'b',
  'i',
  'u',
  'strong',
  'em',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'img',
  'a',
  'span',
  'div',
  'pre',
  'code',
];

const ALLOWED_ATTRIBUTES = {
  img: ['src', 'alt', 'width', 'height'],
  a: ['href', 'title'],
};

const PLUGINFILE_MARKER = '@@PLUGINFILE@@';
const PLUGINFILE_REF_RE = /@@PLUGINFILE@@\/([^"'\s>]+)/g;

function pluginFileFilename(ref: string): string {
  const withoutQuery = ref.split('?')[0];
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
}

export interface SanitizeQuestionHtmlResult {
  html: string;
  hasPluginFiles: boolean;
  unresolvedFiles: string[];
}

export function sanitizeQuestionHtml(
  html: string,
  resolve?: (filename: string) => string | null,
): SanitizeQuestionHtmlResult {
  const hasPluginFiles = html.includes(PLUGINFILE_MARKER);
  const unresolvedFiles: string[] = [];

  const withResolvedPluginfiles = hasPluginFiles
    ? html.replace(PLUGINFILE_REF_RE, (_match, ref: string) => {
        const filename = pluginFileFilename(ref);
        const resolved = resolve ? resolve(filename) : null;
        if (resolved) return resolved;
        unresolvedFiles.push(filename);
        return ref;
      })
    : html;

  const sanitized = sanitizeHtml(withResolvedPluginfiles, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
  });

  return { html: sanitized, hasPluginFiles, unresolvedFiles };
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&apos;': "'",
  '&laquo;': '«',
  '&raquo;': '»',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&[a-zA-Z]+;/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

/**
 * Converts Moodle-style HTML (used e.g. for quiz intros) into plain text
 * suitable for a simple textarea field: strips tags, decodes entities and
 * collapses whitespace/blank lines produced by block-level tags.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';

  const withBreaks = html
    // Block-level boundaries become newlines so paragraphs don't run together.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  const decoded = decodeHtmlEntities(withBreaks);

  return decoded
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

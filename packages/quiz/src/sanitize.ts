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

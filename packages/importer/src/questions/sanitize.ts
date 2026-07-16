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

export function sanitizeQuestionHtml(html: string): { html: string; hasPluginFiles: boolean } {
  const hasPluginFiles = html.includes(PLUGINFILE_MARKER);
  const withoutPluginfile = hasPluginFiles ? html.split(`${PLUGINFILE_MARKER}/`).join('') : html;

  const sanitized = sanitizeHtml(withoutPluginfile, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
  });

  return { html: sanitized, hasPluginFiles };
}

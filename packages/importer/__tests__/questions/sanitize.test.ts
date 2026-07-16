import { describe, expect, it } from 'vitest';
import { sanitizeQuestionHtml } from '../../src/questions/sanitize';

describe('sanitizeQuestionHtml', () => {
  it('keeps allowed tags and strips disallowed ones', () => {
    const result = sanitizeQuestionHtml('<p>Hello <b>world</b></p><script>alert(1)</script>');
    expect(result.html).toBe('<p>Hello <b>world</b></p>');
    expect(result.hasPluginFiles).toBe(false);
  });

  it('keeps only allowed attributes on img and a', () => {
    const result = sanitizeQuestionHtml(
      '<img src="a.png" alt="x" onerror="evil()" style="color:red"><a href="/x" title="t" onclick="evil()">link</a>',
    );
    expect(result.html).toBe('<img src="a.png" alt="x" /><a href="/x" title="t">link</a>');
  });

  it('detects and strips @@PLUGINFILE@@/ references', () => {
    const result = sanitizeQuestionHtml('<img src="@@PLUGINFILE@@/image.png">');
    expect(result.hasPluginFiles).toBe(true);
    expect(result.html).toBe('<img src="image.png" />');
  });

  it('reports no plugin files when none present', () => {
    const result = sanitizeQuestionHtml('<p>plain text</p>');
    expect(result.hasPluginFiles).toBe(false);
  });
});

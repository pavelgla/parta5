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
    expect(result.unresolvedFiles).toEqual([]);
  });

  it('substitutes the resolved URL for a @@PLUGINFILE@@ reference with a query string', () => {
    const result = sanitizeQuestionHtml(
      '<img src="@@PLUGINFILE@@/pic.png?time=1610994686246">',
      (filename) =>
        filename === 'pic.png' ? '/api/files/11111111-1111-1111-1111-111111111111' : null,
    );

    expect(result.html).toBe('<img src="/api/files/11111111-1111-1111-1111-111111111111" />');
    expect(result.hasPluginFiles).toBe(true);
    expect(result.unresolvedFiles).toEqual([]);
  });

  it('URL-decodes the filename before calling resolve', () => {
    const seen: string[] = [];
    sanitizeQuestionHtml('<img src="@@PLUGINFILE@@/1.1.png?time=1">', (filename) => {
      seen.push(filename);
      return null;
    });

    expect(seen).toEqual(['1.1.png']);
  });

  it('leaves the old strip-marker behavior and records the filename as unresolved when resolve returns null', () => {
    const result = sanitizeQuestionHtml(
      '<img src="@@PLUGINFILE@@/missing.png?time=1">',
      () => null,
    );

    expect(result.html).toBe('<img src="missing.png?time=1" />');
    expect(result.unresolvedFiles).toEqual(['missing.png']);
  });

  it('preserves a resolved /api/files/<uuid> URL through sanitize-html', () => {
    const result = sanitizeQuestionHtml(
      '<img src="@@PLUGINFILE@@/a%20b.png">',
      () => '/api/files/22222222-2222-2222-2222-222222222222',
    );

    expect(result.html).toBe('<img src="/api/files/22222222-2222-2222-2222-222222222222" />');
  });
});

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../../src/activities/page';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'minimal-backup');

describe('parsePage', () => {
  it('parses name, sanitized content, and null intro', async () => {
    const page = await parsePage(FIXTURE_DIR, 'activities/page_10');

    expect(page.name).toBe('Welcome page');
    expect(page.contentHtml).toBe('<p>Welcome to the course.</p>');
    expect(page.introHtml).toBeNull();
  });
});

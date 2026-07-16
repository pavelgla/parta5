import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUrl } from '../../src/activities/url';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'minimal-backup');

describe('parseUrl', () => {
  it('parses a youtube external url', async () => {
    const url = await parseUrl(FIXTURE_DIR, 'activities/url_14');

    expect(url.name).toBe('Intro video');
    expect(url.externalurl).toBe('https://www.youtube.com/watch?v=abc123');
    expect(url.introHtml).toBeNull();
  });

  it('parses a plain external url', async () => {
    const url = await parseUrl(FIXTURE_DIR, 'activities/url_15');

    expect(url.name).toBe('Further reading');
    expect(url.externalurl).toBe('https://example.com/reading');
  });
});

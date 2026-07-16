import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLabel } from '../../src/activities/label';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'minimal-backup');

describe('parseLabel', () => {
  it('parses name and sanitized intro as the label content', async () => {
    const label = await parseLabel(FIXTURE_DIR, 'activities/label_13');

    expect(label.name).toBe('Reminder');
    expect(label.introHtml).toBe("<p>Don't forget to submit your homework.</p>");
  });
});

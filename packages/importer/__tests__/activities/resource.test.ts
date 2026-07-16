import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseResource } from '../../src/activities/resource';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'minimal-backup');

describe('parseResource', () => {
  it('parses name and null intro', async () => {
    const resource = await parseResource(FIXTURE_DIR, 'activities/resource_11');

    expect(resource.name).toBe('Course syllabus');
    expect(resource.introHtml).toBeNull();
  });
});

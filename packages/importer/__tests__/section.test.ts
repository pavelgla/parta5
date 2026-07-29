import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSection } from '../src/section';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'minimal-backup');

describe('parseSection', () => {
  it('maps the $@NULL@$ marker to null for a missing name', async () => {
    const section = await parseSection(FIXTURE_DIR, 'sections/section_1');

    expect(section.id).toBe(1);
    expect(section.number).toBe(1);
    expect(section.title).toBeNull();
    expect(section.summaryHtml).toBe('<p>Introductory section.</p>');
    expect(section.sequence).toEqual([10, 11]);
  });

  it('maps the $@NULL@$ marker to null for a missing summary', async () => {
    const section = await parseSection(FIXTURE_DIR, 'sections/section_2');

    expect(section.id).toBe(2);
    expect(section.number).toBe(2);
    expect(section.title).toBe('Chapter 1');
    expect(section.summaryHtml).toBeNull();
    expect(section.sequence).toEqual([12]);
  });
});

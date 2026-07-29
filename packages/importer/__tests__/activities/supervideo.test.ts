import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSupervideo } from '../../src/activities/supervideo';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'minimal-backup');

describe('parseSupervideo', () => {
  it('parses a Google Drive external video link', async () => {
    const supervideo = await parseSupervideo(FIXTURE_DIR, 'activities/supervideo_16');

    expect(supervideo.name).toBe('Устройство БПЛА');
    expect(supervideo.videourl).toBe(
      'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt-uvWxYz/view?usp=drive_link',
    );
    expect(supervideo.introHtml).toBeNull();
  });

  it('parses a videourl of "file" (video uploaded into Moodle, no external link)', async () => {
    const supervideo = await parseSupervideo(FIXTURE_DIR, 'activities/supervideo_17');

    expect(supervideo.name).toBe('Первая помощь на месте');
    expect(supervideo.videourl).toBe('file');
  });
});

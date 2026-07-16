import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { getActivityContextId } from '../../src/activities/context';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'minimal-backup');

describe('getActivityContextId', () => {
  it('reads contextid from module.xml when present', async () => {
    const contextId = await getActivityContextId(FIXTURE_DIR, 'activities/resource_11', 'resource');

    expect(contextId).toBe(100);
  });

  it('falls back to the activity xml root attribute when module.xml is missing', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'parta5-context-'));
    try {
      await writeFile(
        path.join(tmpDir, 'resource.xml'),
        '<?xml version="1.0" encoding="UTF-8"?>\n<activity id="1" moduleid="1" modulename="resource" contextid="42"><resource id="1"></resource></activity>\n',
        'utf-8',
      );

      const contextId = await getActivityContextId(tmpDir, '.', 'resource');

      expect(contextId).toBe(42);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

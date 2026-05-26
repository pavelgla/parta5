import { describe, it, expect } from 'vitest';
import { buildKey } from '../src/index';

describe('buildKey', () => {
  it('formats key as schools/<schoolId>/<assetType>/<uuid>-<name>', () => {
    const key = buildKey('school-abc', 'images', 'uuid-123', 'photo.jpg');
    expect(key).toBe('schools/school-abc/images/uuid-123-photo.jpg');
  });

  it('sanitizes unsafe characters in originalName', () => {
    const key = buildKey('s1', 'files', 'u1', 'my file (v2).pdf');
    expect(key).toBe('schools/s1/files/u1-my_file__v2_.pdf');
  });
});

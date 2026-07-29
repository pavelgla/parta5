import { describe, expect, it } from 'vitest';
import { resolveModuleTitle } from '../src/module-title';

describe('resolveModuleTitle', () => {
  it('uses the section name when present', () => {
    expect(resolveModuleTitle('Chapter 1', 2)).toBe('Chapter 1');
  });

  it('trims whitespace-only names and falls back', () => {
    expect(resolveModuleTitle('   ', 3)).toBe('Раздел 3');
  });

  it('falls back to "Общее" for an unnamed section 0', () => {
    expect(resolveModuleTitle(null, 0)).toBe('Общее');
  });

  it('falls back to "Раздел N" for an unnamed section N > 0', () => {
    expect(resolveModuleTitle(null, 5)).toBe('Раздел 5');
  });
});

import { describe, it, expect } from 'vitest';
import { displayModuleTitle } from './module-title';

describe('displayModuleTitle', () => {
  it('falls back to "Раздел N" for an empty string', () => {
    expect(displayModuleTitle('', 0)).toBe('Раздел 1');
  });

  it('falls back to "Раздел N" for a whitespace-only string', () => {
    expect(displayModuleTitle('   ', 2)).toBe('Раздел 3');
  });

  it('falls back to "Раздел N" for a title that is only digits', () => {
    expect(displayModuleTitle('0', 0)).toBe('Раздел 1');
    expect(displayModuleTitle('12', 4)).toBe('Раздел 5');
  });

  it('keeps a real title as-is', () => {
    expect(displayModuleTitle('Модуль 1: Зачем бегать', 0)).toBe('Модуль 1: Зачем бегать');
  });

  it('falls back to "Раздел N" for null', () => {
    expect(displayModuleTitle(null, 1)).toBe('Раздел 2');
  });

  it('trims surrounding whitespace from a real title', () => {
    expect(displayModuleTitle('  Введение  ', 0)).toBe('Введение');
  });
});

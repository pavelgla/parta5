import { describe, it, expect } from 'vitest';
import { pluralizeLessons, pluralizeModules } from './pluralize';

describe('pluralizeLessons', () => {
  it('uses the singular form for numbers ending in 1 (except 11)', () => {
    expect(pluralizeLessons(1)).toBe('1 урок');
    expect(pluralizeLessons(21)).toBe('21 урок');
    expect(pluralizeLessons(101)).toBe('101 урок');
  });

  it('uses the "few" form for numbers ending in 2-4 (except 12-14)', () => {
    expect(pluralizeLessons(2)).toBe('2 урока');
    expect(pluralizeLessons(3)).toBe('3 урока');
    expect(pluralizeLessons(4)).toBe('4 урока');
    expect(pluralizeLessons(22)).toBe('22 урока');
  });

  it('uses the "many" form for numbers ending in 0, 5-9, and all of 11-14', () => {
    expect(pluralizeLessons(0)).toBe('0 уроков');
    expect(pluralizeLessons(5)).toBe('5 уроков');
    expect(pluralizeLessons(9)).toBe('9 уроков');
    expect(pluralizeLessons(11)).toBe('11 уроков');
    expect(pluralizeLessons(12)).toBe('12 уроков');
    expect(pluralizeLessons(13)).toBe('13 уроков');
    expect(pluralizeLessons(14)).toBe('14 уроков');
    expect(pluralizeLessons(25)).toBe('25 уроков');
    expect(pluralizeLessons(111)).toBe('111 уроков');
  });
});

describe('pluralizeModules', () => {
  it('picks the correct form', () => {
    expect(pluralizeModules(1)).toBe('1 модуль');
    expect(pluralizeModules(2)).toBe('2 модуля');
    expect(pluralizeModules(5)).toBe('5 модулей');
  });
});

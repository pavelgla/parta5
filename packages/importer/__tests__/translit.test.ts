import { describe, expect, it } from 'vitest';
import { slugify } from '../src/translit';

describe('slugify', () => {
  it('transliterates Cyrillic to a lowercase latin slug', () => {
    expect(slugify('Охрана труда')).toBe('ohrana-truda');
  });

  it('lowercases latin input and strips punctuation', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses whitespace and repeated dashes', () => {
    expect(slugify('  Тест   курс  ')).toBe('test-kurs');
  });
});

import { describe, it, expect } from 'vitest';
import { stripHtml, truncateText } from './strip-html';

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Привет,  <b>мир</b>!</p>')).toBe('Привет, мир !');
  });

  it('decodes common named entities', () => {
    expect(stripHtml('Правда&nbsp;&amp;&nbsp;вымысел')).toBe('Правда & вымысел');
  });

  it('decodes numeric entities', () => {
    expect(stripHtml('&#1055;&#x440;&#x438;&#x432;&#x435;&#x442;')).toBe('Привет');
  });
});

describe('truncateText', () => {
  it('returns the text unchanged when within the limit', () => {
    expect(truncateText('коротко', 20)).toBe('коротко');
  });

  it('truncates and adds an ellipsis when over the limit', () => {
    expect(truncateText('это очень длинное описание курса', 10)).toBe('это очень…');
  });
});

import { describe, it, expect } from 'vitest';
import {
  BRAND_COLOR_RE,
  DEFAULT_BRAND_COLOR,
  footerLinksSchema,
  parseFooterLinks,
  normalizeHost,
  brandForeground,
} from './brand';

describe('BRAND_COLOR_RE', () => {
  it('accepts valid 6-digit hex colors', () => {
    expect(BRAND_COLOR_RE.test('#2B4E84')).toBe(true);
    expect(BRAND_COLOR_RE.test('#ffffff')).toBe(true);
    expect(BRAND_COLOR_RE.test(DEFAULT_BRAND_COLOR)).toBe(true);
  });

  it('rejects invalid colors', () => {
    expect(BRAND_COLOR_RE.test('2B4E84')).toBe(false);
    expect(BRAND_COLOR_RE.test('#2B4')).toBe(false);
    expect(BRAND_COLOR_RE.test('#GGGGGG')).toBe(false);
    expect(BRAND_COLOR_RE.test('red')).toBe(false);
    expect(BRAND_COLOR_RE.test('')).toBe(false);
  });
});

describe('footerLinksSchema / parseFooterLinks', () => {
  it('parses a valid list of links', () => {
    const value = [
      { title: 'О школе', url: 'https://example.com/about' },
      { title: 'Контакты', url: 'https://example.com/contacts' },
    ];
    expect(parseFooterLinks(value)).toEqual(value);
  });

  it('returns [] for garbage input', () => {
    expect(parseFooterLinks(null)).toEqual([]);
    expect(parseFooterLinks(undefined)).toEqual([]);
    expect(parseFooterLinks('not an array')).toEqual([]);
    expect(parseFooterLinks({})).toEqual([]);
    expect(parseFooterLinks([{ title: 'no url' }])).toEqual([]);
    expect(parseFooterLinks([{ title: '', url: 'https://example.com' }])).toEqual([]);
    expect(parseFooterLinks([{ title: 'Bad url', url: 'not-a-url' }])).toEqual([]);
  });

  it('rejects more than 8 links', () => {
    const value = Array.from({ length: 9 }, (_, i) => ({
      title: `Link ${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(footerLinksSchema.safeParse(value).success).toBe(false);
    expect(parseFooterLinks(value)).toEqual([]);
  });

  it('accepts exactly 8 links', () => {
    const value = Array.from({ length: 8 }, (_, i) => ({
      title: `Link ${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(parseFooterLinks(value)).toEqual(value);
  });
});

describe('normalizeHost', () => {
  it('strips the port and lowercases the host', () => {
    expect(normalizeHost('PSR.parta5.ru:3000')).toBe('psr.parta5.ru');
    expect(normalizeHost('psr.parta5.ru')).toBe('psr.parta5.ru');
  });

  it('returns null for empty/nullish input', () => {
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost(undefined)).toBeNull();
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('   ')).toBeNull();
  });
});

describe('brandForeground', () => {
  it('picks near-black text on a white background', () => {
    expect(brandForeground('#ffffff')).toBe('#1d2125');
  });

  it('picks white text on the ПрофСпецРесурс dark blue', () => {
    expect(brandForeground('#2B4E84')).toBe('#ffffff');
  });

  it('picks white text on black and on the default brand blue', () => {
    expect(brandForeground('#000000')).toBe('#ffffff');
    expect(brandForeground(DEFAULT_BRAND_COLOR)).toBe('#ffffff');
  });

  it('falls back to white for malformed input', () => {
    expect(brandForeground('not-a-color')).toBe('#ffffff');
  });
});

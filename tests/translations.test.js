import { describe, it, expect } from 'vitest';
import { TRANSLATIONS, t } from '../src/translations.js';

const LANGS = Object.keys(TRANSLATIONS);
const placeholders = (str) => [...str.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('ships English, Spanish, French and German', () => {
    expect([...LANGS].sort()).toEqual(['de', 'en', 'es', 'fr']);
  });

  it.each(LANGS)('%s has exactly the same keys as English', (lang) => {
    expect(Object.keys(TRANSLATIONS[lang]).sort()).toEqual(Object.keys(TRANSLATIONS.en).sort());
  });

  it.each(LANGS)('%s uses the same placeholders as English', (lang) => {
    for (const [key, value] of Object.entries(TRANSLATIONS.en)) {
      expect(placeholders(TRANSLATIONS[lang][key]), `${lang}.${key}`).toEqual(placeholders(value));
    }
  });

  it.each(LANGS)('%s has no empty strings', (lang) => {
    for (const [key, value] of Object.entries(TRANSLATIONS[lang])) {
      expect(value.trim(), `${lang}.${key}`).not.toBe('');
    }
  });
});

describe('t()', () => {
  it('interpolates parameters', () => {
    expect(t('level_display', { val: 7 })).toContain('7');
  });

  it('falls back to the key when it is missing', () => {
    expect(t('this_key_does_not_exist')).toBe('this_key_does_not_exist');
  });
});

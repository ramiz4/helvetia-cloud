import { describe, expect, it } from 'vitest';
import { translations } from '../translations';

describe('translations', () => {
  it('should have all language translations', () => {
    expect(translations.en).toBeDefined();
    expect(translations.de).toBeDefined();
    expect(translations.fr).toBeDefined();
    expect(translations.it).toBeDefined();
    expect(translations.gsw).toBeDefined();
  });

  it('should have consistent structure across languages', () => {
    const languages = ['en', 'de', 'fr', 'it', 'gsw'] as const;
    const baseKeys = Object.keys(translations.en);

    languages.forEach((lang) => {
      const langKeys = Object.keys(translations[lang]);
      expect(langKeys).toEqual(baseKeys);
    });
  });

  it('should have common translation keys', () => {
    expect(translations.en.common).toBeDefined();
    expect(translations.en.nav).toBeDefined();
    // Note: Not all translations may have all keys
  });
});

import de from '../locales/de.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import gsw from '../locales/gsw.json';
import it from '../locales/it.json';

export type Language = 'en' | 'de' | 'fr' | 'it' | 'gsw';

export const translations = {
  en,
  de,
  fr,
  it,
  gsw,
} as const;

export type Translations = (typeof translations)['en'];

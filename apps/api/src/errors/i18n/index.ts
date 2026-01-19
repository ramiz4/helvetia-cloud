import type { ErrorCode } from '../ErrorCodes.js';
import { en } from './en.js';

/**
 * Supported languages
 */
export type Language = 'en';

/**
 * Translation catalogs
 */
const translations: Record<Language, Record<ErrorCode, string>> = {
  en,
};

/**
 * Get localized error message
 * @param code - Error code
 * @param language - Language code (defaults to 'en')
 * @param customMessage - Optional custom message override
 * @returns Localized error message
 */
export function getLocalizedErrorMessage(
  code: ErrorCode,
  language: Language = 'en',
  customMessage?: string,
): string {
  if (customMessage) {
    return customMessage;
  }

  const catalog = translations[language];
  return catalog?.[code] || translations.en[code];
}

/**
 * Detect language from Accept-Language header
 * @param acceptLanguage - Accept-Language header value
 * @returns Detected language code
 */
export function detectLanguage(acceptLanguage?: string): Language {
  if (!acceptLanguage) {
    return 'en';
  }

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
  const languages = acceptLanguage.split(',').map((lang) => {
    const [code] = lang.trim().split(';');
    return code.split('-')[0].toLowerCase();
  });

  // Return first supported language or default to English
  for (const lang of languages) {
    if (lang in translations) {
      return lang as Language;
    }
  }

  return 'en';
}

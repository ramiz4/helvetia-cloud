import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../ErrorCodes';
import { detectLanguage, getLocalizedErrorMessage } from './index';

describe('Error i18n', () => {
  describe('getLocalizedErrorMessage', () => {
    it('should return localized message for error code', () => {
      const message = getLocalizedErrorMessage(ErrorCode.AUTH_UNAUTHORIZED, 'en');
      expect(message).toBe('You are not authorized to access this resource');
    });

    it('should return custom message when provided', () => {
      const customMessage = 'Custom error message';
      const message = getLocalizedErrorMessage(ErrorCode.AUTH_UNAUTHORIZED, 'en', customMessage);
      expect(message).toBe(customMessage);
    });

    it('should default to English when language is not specified', () => {
      const message = getLocalizedErrorMessage(ErrorCode.SERVICE_NOT_FOUND);
      expect(message).toBe('Service not found');
    });

    it('should return all error codes have translations', () => {
      // Test a few key error codes
      expect(getLocalizedErrorMessage(ErrorCode.VALIDATION_FAILED, 'en')).toBeTruthy();
      expect(getLocalizedErrorMessage(ErrorCode.RESOURCE_NOT_FOUND, 'en')).toBeTruthy();
      expect(getLocalizedErrorMessage(ErrorCode.SYSTEM_ERROR, 'en')).toBeTruthy();
      expect(getLocalizedErrorMessage(ErrorCode.AUTH_TOKEN_EXPIRED, 'en')).toBeTruthy();
    });
  });

  describe('detectLanguage', () => {
    it('should detect English from Accept-Language header', () => {
      const lang = detectLanguage('en-US,en;q=0.9');
      expect(lang).toBe('en');
    });

    it('should detect English from complex Accept-Language header', () => {
      const lang = detectLanguage('en-US,en;q=0.9,es;q=0.8,fr;q=0.7');
      expect(lang).toBe('en');
    });

    it('should default to English when header is not provided', () => {
      const lang = detectLanguage(undefined);
      expect(lang).toBe('en');
    });

    it('should default to English when unsupported language is requested', () => {
      const lang = detectLanguage('ja-JP,ja;q=0.9');
      expect(lang).toBe('en');
    });

    it('should handle malformed Accept-Language headers', () => {
      const lang = detectLanguage('invalid-header');
      expect(lang).toBe('en');
    });
  });
});

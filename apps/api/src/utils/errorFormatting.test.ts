import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatZodError, formatZodErrorTree } from './errorFormatting.js';

describe('errorFormatting', () => {
  describe('formatZodError', () => {
    it('should format a simple validation error', () => {
      const schema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
      });

      try {
        schema.parse({ name: 'ab', email: 'invalid' });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error);

          expect(formatted).toHaveProperty('formErrors');
          expect(formatted).toHaveProperty('fieldErrors');
          expect(Array.isArray(formatted.formErrors)).toBe(true);
          expect(typeof formatted.fieldErrors).toBe('object');
        } else {
          expect.fail('Error should be ZodError');
        }
      }
    });

    it('should format nested validation errors', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(3),
          email: z.string().email(),
        }),
      });

      try {
        schema.parse({ user: { name: '', email: 'invalid' } });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error);

          expect(formatted).toHaveProperty('fieldErrors');
          expect(typeof formatted.fieldErrors).toBe('object');
          // Field errors should be properly structured
          const fieldErrors = formatted.fieldErrors as Record<string, string[]>;
          expect(Object.keys(fieldErrors).length).toBeGreaterThan(0);
        } else {
          expect.fail('Error should be ZodError');
        }
      }
    });

    it('should handle multiple errors on the same field', () => {
      const schema = z.object({
        password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
      });

      try {
        schema.parse({ password: 'short' });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error);

          expect(formatted).toHaveProperty('fieldErrors');
          const fieldErrors = formatted.fieldErrors as Record<string, string[]>;
          expect(fieldErrors.password).toBeDefined();
          expect(Array.isArray(fieldErrors.password)).toBe(true);
        } else {
          expect.fail('Error should be ZodError');
        }
      }
    });

    it('should handle array fields with errors', () => {
      const schema = z.object({
        tags: z.array(z.string().min(1)),
      });

      try {
        schema.parse({ tags: ['', 'valid', ''] });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error);

          expect(formatted).toHaveProperty('fieldErrors');
          const fieldErrors = formatted.fieldErrors as Record<string, string[]>;
          // Should have errors for the array field
          expect(Object.keys(fieldErrors).length).toBeGreaterThan(0);
        } else {
          expect.fail('Error should be ZodError');
        }
      }
    });
  });

  describe('formatZodErrorTree', () => {
    it('should format errors in tree structure', () => {
      const schema = z.object({
        name: z.string().min(3),
        nested: z.object({
          field: z.string(),
        }),
      });

      try {
        schema.parse({ name: 'ab', nested: { field: '' } });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodErrorTree(error);

          // Tree structure should exist
          expect(formatted).toBeDefined();
          expect(typeof formatted).toBe('object');
        } else {
          expect.fail('Error should be ZodError');
        }
      }
    });
  });
});

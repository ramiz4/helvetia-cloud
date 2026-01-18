import { z } from 'zod';

/**
 * Schema for getting terms by version
 */
export const GetTermsSchema = z.object({
  version: z.string().min(1).max(20),
  language: z.enum(['en', 'de', 'fr', 'it', 'gsw']).optional().default('en'),
});

/**
 * Schema for accepting terms
 */
export const AcceptTermsSchema = z.object({
  termsVersionId: z.string().uuid(),
});

/**
 * Schema for creating a terms version (admin only)
 */
export const CreateTermsVersionSchema = z.object({
  version: z.string().min(1).max(20),
  content: z.string().min(1),
  language: z.enum(['en', 'de', 'fr', 'it', 'gsw']),
  effectiveAt: z.string().datetime().or(z.date()),
});

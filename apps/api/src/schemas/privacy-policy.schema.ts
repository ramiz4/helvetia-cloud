import { z } from 'zod';

/**
 * Schema for getting privacy policy by version
 */
export const GetPrivacyPolicySchema = z.object({
  version: z.string().min(1).max(20),
  language: z.enum(['en', 'de', 'fr', 'it', 'gsw']).optional().default('en'),
});

/**
 * Schema for accepting privacy policy
 */
export const AcceptPrivacyPolicySchema = z.object({
  privacyPolicyVersionId: z.string().uuid(),
});

/**
 * Schema for creating a privacy policy version (admin only)
 */
export const CreatePrivacyPolicyVersionSchema = z.object({
  version: z.string().min(1).max(20),
  content: z.string().min(1),
  language: z.enum(['en', 'de', 'fr', 'it', 'gsw']),
  effectiveAt: z.string().datetime().or(z.date()),
});

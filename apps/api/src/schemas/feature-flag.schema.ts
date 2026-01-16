import { z } from 'zod';

/**
 * Schema for creating a feature flag
 */
export const CreateFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/i, {
      message: 'Key must contain only letters, numbers, underscores, and hyphens',
    }),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional().default(false),
  segments: z
    .object({
      type: z.enum(['userIds', 'percentage']).optional(),
      userIds: z.array(z.string()).optional(),
      percentage: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

/**
 * Schema for updating a feature flag
 */
export const UpdateFlagSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  segments: z
    .object({
      type: z.enum(['userIds', 'percentage']).optional(),
      userIds: z.array(z.string()).optional(),
      percentage: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

/**
 * Schema for checking feature flag status
 */
export const CheckFlagSchema = z.object({
  key: z.string().min(1),
  userId: z.string().optional(),
});

/**
 * Schema for checking multiple feature flags at once
 */
export const CheckBulkFlagSchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(50), // Limit to 50 flags per request
  userId: z.string().optional(),
});

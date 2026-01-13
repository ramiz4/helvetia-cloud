import { z } from 'zod';

/**
 * Format Zod validation error using the new Zod v4 API
 * Uses z.flattenError for a structured error response that's easy for frontends to consume
 *
 * @param error - The ZodError instance
 * @returns Formatted error object with formErrors and fieldErrors
 *
 * @example
 * ```typescript
 * try {
 *   schema.parse(data);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     return reply.status(400).send({
 *       error: 'Validation failed',
 *       details: formatZodError(error)
 *     });
 *   }
 * }
 * ```
 */
export function formatZodError(error: z.ZodError) {
  return z.flattenError(error);
}

/**
 * Format Zod validation error with tree structure for nested objects
 * Uses z.treeifyError for deeply nested schemas
 *
 * @param error - The ZodError instance
 * @returns Tree-structured error object matching the input schema shape
 */
export function formatZodErrorTree(error: z.ZodError) {
  return z.treeifyError(error);
}

/**
 * Zod v4 flattened error structure (from z.flattenError)
 */
export interface ZodFlattenedError {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
}

/**
 * Legacy validation error format (deprecated)
 */
export interface LegacyValidationError {
  field: string;
  message: string;
}

export async function getErrorMessage(
  response: Response,
  defaultMessage: string = 'An unknown error occurred',
): Promise<string> {
  try {
    const data = await response.json();

    // Case 1: Standard 'message' field
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }

    // Case 2a: New Zod v4 validation 'details' structure (z.flattenError)
    if (data.details && typeof data.details === 'object') {
      const details = data.details as Partial<ZodFlattenedError>;

      // Return first form error if available
      if (
        details.formErrors &&
        Array.isArray(details.formErrors) &&
        details.formErrors.length > 0
      ) {
        return details.formErrors[0];
      }

      // Return first field error if available
      if (details.fieldErrors && typeof details.fieldErrors === 'object') {
        const firstFieldErrors = Object.values(details.fieldErrors)[0];
        if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
          return firstFieldErrors[0];
        }
      }
    }

    // Case 2b: Legacy validation 'details' array (deprecated but still supported)
    if (data.details && Array.isArray(data.details) && data.details.length > 0) {
      const firstDetail = data.details[0] as LegacyValidationError;
      if (firstDetail.message) return firstDetail.message;
    }

    // Case 3: 'error' field as string
    if (data.error && typeof data.error === 'string') {
      return data.error;
    }

    // Case 4: AppError format { error: { message: '...' } }
    if (data.error && data.error.message) {
      return data.error.message;
    }

    return `${defaultMessage} (Status ${response.status})`;
  } catch {
    return `${defaultMessage} (Status ${response.status})`;
  }
}

/**
 * Get all validation errors from a response
 * Supports both new Zod v4 format and legacy format
 */
export async function getValidationErrors(
  response: Response,
): Promise<Record<string, string[]> | null> {
  try {
    const data = await response.json();

    if (!data.details) return null;

    // New Zod v4 format
    if (typeof data.details === 'object' && 'fieldErrors' in data.details) {
      const details = data.details as ZodFlattenedError;
      return details.fieldErrors;
    }

    // Legacy format - convert to new format
    if (Array.isArray(data.details)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const detail of data.details as LegacyValidationError[]) {
        if (!fieldErrors[detail.field]) {
          fieldErrors[detail.field] = [];
        }
        fieldErrors[detail.field].push(detail.message);
      }
      return fieldErrors;
    }

    return null;
  } catch {
    return null;
  }
}

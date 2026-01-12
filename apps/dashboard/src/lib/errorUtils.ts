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

    // Case 2: Validation 'details' array (e.g. from Zen/Zod)
    if (data.details && Array.isArray(data.details) && data.details.length > 0) {
      if (data.details[0].message) return data.details[0].message;
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

'use client';

import { useCallback, useState } from 'react';
import type { ApiErrorResponse } from '../utils/apiErrors';
import { parseApiError } from '../utils/apiErrors';

interface UseApiErrorOptions {
  onError?: (error: ApiErrorResponse) => void;
}

/**
 * Custom hook for managing API errors
 */
export function useApiError(options?: UseApiErrorOptions) {
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Set an error from a Response object
   */
  const setErrorFromResponse = useCallback(
    async (response: Response) => {
      const apiError = await parseApiError(response);
      if (apiError) {
        setError(apiError);
        options?.onError?.(apiError);
      }
    },
    [options],
  );

  /**
   * Set an error directly
   */
  const setErrorDirect = useCallback(
    (apiError: ApiErrorResponse) => {
      setError(apiError);
      options?.onError?.(apiError);
    },
    [options],
  );

  /**
   * Wrap an async function to automatically handle errors
   */
  const withErrorHandling = useCallback(
    <T>(fn: () => Promise<T>) => {
      return async (): Promise<T | null> => {
        try {
          clearError();
          return await fn();
        } catch (err) {
          if (err instanceof Response) {
            await setErrorFromResponse(err);
          } else if (err && typeof err === 'object' && 'error' in err) {
            setErrorDirect(err as ApiErrorResponse);
          }
          return null;
        }
      };
    },
    [clearError, setErrorFromResponse, setErrorDirect],
  );

  return {
    error,
    setError: setErrorDirect,
    setErrorFromResponse,
    clearError,
    withErrorHandling,
  };
}

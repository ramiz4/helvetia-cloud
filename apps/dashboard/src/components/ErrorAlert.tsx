'use client';

import { useEffect, useState } from 'react';
import type { ApiErrorResponse } from '../utils/apiErrors';
import { getUserFriendlyErrorMessage } from '../utils/apiErrors';

interface ErrorAlertProps {
  error: ApiErrorResponse | string | null;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  className?: string;
}

/**
 * ErrorAlert component for displaying API errors in a user-friendly way
 */
export function ErrorAlert({
  error,
  onDismiss,
  autoDismiss = false,
  autoDismissDelay = 5000,
  className = '',
}: ErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (error && autoDismiss) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [error, autoDismiss, autoDismissDelay, onDismiss]);

  useEffect(() => {
    setIsVisible(!!error);
  }, [error]);

  if (!error || !isVisible) {
    return null;
  }

  const message = typeof error === 'string' ? error : getUserFriendlyErrorMessage(error);
  const errorCode = typeof error === 'string' ? undefined : error.error.code;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className={`rounded-lg bg-red-50 p-4 border border-red-200 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-red-800">{message}</p>
          {errorCode && process.env.NODE_ENV === 'development' && (
            <p className="mt-1 text-xs text-red-700">Error code: {errorCode}</p>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                aria-label="Dismiss"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

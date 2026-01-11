import type { ErrorCode } from './ErrorCodes';
import { ErrorMessages } from './ErrorCodes';
import { getLocalizedErrorMessage, type Language } from './i18n';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    statusCode: number;
  };
}

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  private readonly language: Language;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode: number = 500,
    details?: unknown,
    isOperational: boolean = true,
    language: Language = 'en',
  ) {
    // Use custom message, localized message, or default message
    const finalMessage = message || getLocalizedErrorMessage(code, language) || ErrorMessages[code];
    super(finalMessage);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.language = language;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to standard error response format
   */
  toJSON(): ErrorResponse {
    const errorObj: ErrorResponse = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
      },
    };

    if (this.details) {
      errorObj.error.details = this.details;
    }

    return errorObj;
  }
}

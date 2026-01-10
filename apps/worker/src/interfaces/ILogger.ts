/**
 * Log level type
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log context - additional data to include with log message
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Interface for logging operations
 */
export interface ILogger {
  /**
   * Log a trace message
   */
  trace(message: string, context?: LogContext): void;
  trace(context: LogContext, message: string): void;

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void;
  debug(context: LogContext, message: string): void;

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void;
  info(context: LogContext, message: string): void;

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void;
  warn(context: LogContext, message: string): void;

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext): void;
  error(context: LogContext, message: string): void;
  error(error: Error, context?: LogContext): void;

  /**
   * Log a fatal message
   */
  fatal(message: string, context?: LogContext): void;
  fatal(context: LogContext, message: string): void;

  /**
   * Create a child logger with additional context
   */
  child(bindings: LogContext): ILogger;
}

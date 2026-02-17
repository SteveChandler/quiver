/**
 * General-purpose logger with log levels
 *
 * In production: only warn and error are logged
 * In development: all levels are logged
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.debug('Detailed debug info', { data });  // Dev only
 *   logger.info('Operation completed', { result }); // Dev only
 *   logger.warn('Something unexpected', { context }); // Always
 *   logger.error('Operation failed', error);          // Always
 *
 * With context prefix:
 *   const log = logger.withContext('MyService');
 *   log.info('Starting');  // [MyService] Starting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Determines if we're in a production environment
 */
function isProduction(): boolean {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
  return env === 'production';
}

/**
 * Gets the minimum log level based on environment
 * Production: warn (2) - only warn and error
 * Development: debug (0) - all logs
 */
function getMinLogLevel(): number {
  // Allow override via environment variable
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel];
  }
  return isProduction() ? LOG_LEVELS.warn : LOG_LEVELS.debug;
}

/**
 * Formats arguments for logging, handling errors specially
 */
function formatArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return {
        message: arg.message,
        name: arg.name,
        stack: arg.stack,
      };
    }
    return arg;
  });
}

/**
 * Creates a log function for a specific level
 */
function createLogFn(
  level: LogLevel,
  prefix?: string
): (...args: unknown[]) => void {
  const levelValue = LOG_LEVELS[level];

  return (...args: unknown[]) => {
    if (levelValue < getMinLogLevel()) {
      return;
    }

    const formattedArgs = formatArgs(args);
    const prefixStr = prefix ? `[${prefix}]` : '';
    const logArgs = prefixStr ? [prefixStr, ...formattedArgs] : formattedArgs;

    switch (level) {
      case 'debug':
        // Use console.log for debug since console.debug may be hidden in some browsers
        console.log(...logArgs);
        break;
      case 'info':
        console.info(...logArgs);
        break;
      case 'warn':
        console.warn(...logArgs);
        break;
      case 'error':
        console.error(...logArgs);
        break;
    }
  };
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  withContext: (context: string) => Logger;
}

/**
 * Creates a logger instance, optionally with a context prefix
 */
function createLogger(context?: string): Logger {
  return {
    debug: createLogFn('debug', context),
    info: createLogFn('info', context),
    warn: createLogFn('warn', context),
    error: createLogFn('error', context),
    withContext: (newContext: string) =>
      createLogger(context ? `${context}:${newContext}` : newContext),
  };
}

/**
 * Default logger instance
 *
 * @example
 * import { logger } from '@/lib/logger';
 *
 * // Simple usage (replaces console.log)
 * logger.debug('Fetching data...');
 * logger.info('Data fetched', { count: 10 });
 * logger.warn('Rate limit approaching', { remaining: 5 });
 * logger.error('Failed to fetch', error);
 *
 * // With context prefix
 * const log = logger.withContext('CDIPService');
 * log.info('Fetching buoy data'); // [CDIPService] Fetching buoy data
 */
const logger = createLogger();

/**
 * Create a logger with a specific context
 * Shorthand for logger.withContext()
 *
 * @example
 * import { createContextLogger } from '@/lib/logger';
 *
 * const log = createContextLogger('MyService');
 * log.info('Starting'); // [MyService] Starting
 */
export function createContextLogger(context: string): Logger {
  return createLogger(context);
}

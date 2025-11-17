/**
 * Retry utility with exponential backoff
 * Designed for user-initiated retries in components
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, delay: number) => void;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Retry a function with exponential backoff
 *
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   async () => fetch('/api/forecast'),
 *   {
 *     maxRetries: 3,
 *     baseDelay: 1000,
 *     onRetry: (attempt, delay) => {
 *       console.log(`Retry attempt ${attempt}, waiting ${delay}ms`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    exponentialBase = 2,
    jitter = true,
    onRetry,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      let delay = baseDelay * Math.pow(exponentialBase, attempt);

      // Add jitter to prevent thundering herd
      if (jitter) {
        const jitterRange = delay * 0.25;
        delay += (Math.random() - 0.5) * 2 * jitterRange;
      }

      // Clamp to max delay
      delay = Math.min(delay, maxDelay);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, delay);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Check if an error is retryable based on common patterns
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.name === "TypeError" && error.message?.includes("fetch")) {
    return true;
  }

  // Timeout errors
  if (error.name === "AbortError" || error.message?.includes("timeout")) {
    return true;
  }

  // HTTP status codes that should be retried
  if (error.status) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.status);
  }

  // Rate limiting
  if (error.message?.toLowerCase().includes("rate limit")) {
    return true;
  }

  return false;
}

/**
 * Create a retry function with specific configuration
 * Useful for creating specialized retry functions
 *
 * @example
 * ```typescript
 * const retryForecastFetch = createRetryFn({
 *   maxRetries: 2,
 *   baseDelay: 2000,
 *   shouldRetry: isRetryableError
 * });
 *
 * const data = await retryForecastFetch(
 *   () => fetch('/api/forecast')
 * );
 * ```
 */
export function createRetryFn(defaultOptions: RetryOptions = {}) {
  return async function retry<T>(
    fn: () => Promise<T>,
    overrideOptions: RetryOptions = {}
  ): Promise<T> {
    return retryWithBackoff(fn, { ...defaultOptions, ...overrideOptions });
  };
}

/**
 * Specialized retry function for forecast fetches
 * Configured with sensible defaults for forecast API calls
 */
export const retryForecastFetch = createRetryFn({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 15000,
  shouldRetry: isRetryableError,
});

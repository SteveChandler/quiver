export type RetryStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Calculate retry delay based on strategy
 */
export function retryWithBackoff(
  attempt: number,
  strategy: RetryStrategy,
  baseDelay: number
): number {
  switch (strategy) {
    case 'exponential':
      return baseDelay * Math.pow(2, attempt);

    case 'linear':
      return baseDelay * (attempt + 1);

    case 'fixed':
    default:
      return baseDelay;
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    'network',
    'timeout',
    'fetch',
    'connection',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ];

  const errorMessage = error.message.toLowerCase();

  return retryableMessages.some((msg) => errorMessage.includes(msg));
}

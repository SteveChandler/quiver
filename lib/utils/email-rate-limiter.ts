/**
 * Email Rate Limiter Utility
 *
 * Provides sequential rate limiting for email sending APIs (e.g., Resend).
 * Unlike the general RateLimiter that tracks request counts, this utility
 * ensures minimum delays between sequential operations.
 *
 * Resend API limit: 2 requests/second
 * We use 600ms between requests (500ms + 100ms buffer for safety)
 */

/**
 * Resend API rate limit: 2 requests/second
 * Add 100ms buffer for safety = 600ms between requests
 */
export const RESEND_RATE_LIMIT_MS = 600;

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sequential rate limiter for operations that must respect time-based limits.
 * Tracks time since last call and ensures minimum interval between calls.
 */
export class SequentialRateLimiter {
  private lastCallTime: number = 0;

  constructor(private intervalMs: number) {}

  /**
   * Wait if necessary to respect rate limit, then update last call time.
   * Call this before each rate-limited operation.
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (this.lastCallTime > 0 && timeSinceLastCall < this.intervalMs) {
      const waitTime = this.intervalMs - timeSinceLastCall;
      await sleep(waitTime);
    }

    this.lastCallTime = Date.now();
  }

  /**
   * Check if we need to wait (without actually waiting).
   * Useful for logging or conditional logic.
   */
  shouldWait(): boolean {
    if (this.lastCallTime === 0) return false;
    const timeSinceLastCall = Date.now() - this.lastCallTime;
    return timeSinceLastCall < this.intervalMs;
  }

  /**
   * Get remaining wait time in milliseconds.
   * Returns 0 if no wait is needed.
   */
  getRemainingWaitTime(): number {
    if (this.lastCallTime === 0) return 0;
    const timeSinceLastCall = Date.now() - this.lastCallTime;
    return Math.max(0, this.intervalMs - timeSinceLastCall);
  }

  /**
   * Reset the rate limiter (e.g., at start of new batch).
   */
  reset(): void {
    this.lastCallTime = 0;
  }
}

/**
 * Create a rate limiter configured for Resend email sending.
 * Use this in email cron routes for consistent rate limiting.
 *
 * @example
 * const rateLimiter = createResendRateLimiter();
 * for (const recipient of recipients) {
 *   await rateLimiter.throttle();
 *   await resend.emails.send({...});
 * }
 */
export function createResendRateLimiter(): SequentialRateLimiter {
  return new SequentialRateLimiter(RESEND_RATE_LIMIT_MS);
}

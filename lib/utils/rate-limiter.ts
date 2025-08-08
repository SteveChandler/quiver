/**
 * Rate Limiter Utility for API Requests
 *
 * Implements configurable rate limiting for external API calls
 * to respect service limits and prevent API key suspension.
 *
 * Features:
 * - Per-minute and per-hour limits
 * - Burst protection
 * - Automatic cleanup of old request history
 * - Singleton pattern for shared state
 * - Configurable limits per service
 */

import { RateLimiterConfig, RateLimitStatus } from "@/types/forecast";

interface RequestRecord {
  timestamp: number;
  endpoint?: string;
}

export class RateLimiter {
  private requestHistory: RequestRecord[] = [];
  private readonly config: RateLimiterConfig;
  private readonly name: string;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(name: string, config: RateLimiterConfig) {
    this.name = name;
    this.config = this.validateConfig(config);

    // Start cleanup interval to prevent memory leaks
    this.startCleanupInterval();
  }

  private validateConfig(config: RateLimiterConfig): RateLimiterConfig {
    return {
      requestsPerMinute: Math.max(1, config.requestsPerMinute || 60),
      requestsPerHour: Math.max(1, config.requestsPerHour || 1000),
      burstLimit: Math.max(1, config.burstLimit || 5),
    };
  }

  private startCleanupInterval(): void {
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldRequests();
      }, 60000); // Cleanup every minute
    }
  }

  private cleanupOldRequests(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Keep only requests from the last hour
    this.requestHistory = this.requestHistory.filter(
      (record) => record.timestamp > oneHourAgo
    );
  }

  /**
   * Check if a new request can be made within rate limits
   */
  canMakeRequest(): boolean {
    try {
      const now = Date.now();

      // Check burst limit (recent requests within burst window)
      const burstWindow = 60 * 1000; // 1 minute
      const recentRequests = this.requestHistory.filter(
        (record) => record.timestamp > now - burstWindow
      );

      if (recentRequests.length >= this.config.burstLimit) {
        console.warn(
          `${this.name}: Burst limit exceeded (${recentRequests.length}/${this.config.burstLimit})`
        );
        return false;
      }

      // Check per-minute limit
      const oneMinuteAgo = now - 60 * 1000;
      const requestsLastMinute = this.requestHistory.filter(
        (record) => record.timestamp > oneMinuteAgo
      );

      if (requestsLastMinute.length >= this.config.requestsPerMinute) {
        console.warn(
          `${this.name}: Per-minute limit exceeded (${requestsLastMinute.length}/${this.config.requestsPerMinute})`
        );
        return false;
      }

      // Check per-hour limit
      const oneHourAgo = now - 60 * 60 * 1000;
      const requestsLastHour = this.requestHistory.filter(
        (record) => record.timestamp > oneHourAgo
      );

      if (requestsLastHour.length >= this.config.requestsPerHour) {
        console.warn(
          `${this.name}: Per-hour limit exceeded (${requestsLastHour.length}/${this.config.requestsPerHour})`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(`${this.name}: Error checking rate limit:`, error);
      return false; // Fail safe
    }
  }

  /**
   * Record a new request
   */
  recordRequest(endpoint?: string): void {
    try {
      const now = Date.now();
      this.requestHistory.push({
        timestamp: now,
        endpoint,
      });

      // Immediate cleanup if history gets too large
      if (this.requestHistory.length > this.config.requestsPerHour * 2) {
        this.cleanupOldRequests();
      }
    } catch (error) {
      console.error(`${this.name}: Error recording request:`, error);
    }
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getTimeUntilReset(): number {
    try {
      const now = Date.now();

      // Find the oldest request that's still within limits
      const oneMinuteAgo = now - 60 * 1000;
      const requestsLastMinute = this.requestHistory.filter(
        (record) => record.timestamp > oneMinuteAgo
      );

      if (requestsLastMinute.length >= this.config.requestsPerMinute) {
        // Find oldest request in the last minute
        const oldestInMinute = Math.min(
          ...requestsLastMinute.map((r) => r.timestamp)
        );
        return Math.max(0, oldestInMinute + 60 * 1000 - now);
      }

      const burstWindow = 60 * 1000;
      const recentRequests = this.requestHistory.filter(
        (record) => record.timestamp > now - burstWindow
      );

      if (recentRequests.length >= this.config.burstLimit) {
        const oldestInBurst = Math.min(
          ...recentRequests.map((r) => r.timestamp)
        );
        return Math.max(0, oldestInBurst + burstWindow - now);
      }

      return 0;
    } catch (error) {
      console.error(`${this.name}: Error calculating reset time:`, error);
      return 60000; // Default to 1 minute
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    try {
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      const requestsLastMinute = this.requestHistory.filter(
        (record) => record.timestamp > oneMinuteAgo
      ).length;

      return {
        canMakeRequest: this.canMakeRequest(),
        timeUntilReset: this.getTimeUntilReset(),
        requestsRemaining: Math.max(
          0,
          this.config.requestsPerMinute - requestsLastMinute
        ),
      };
    } catch (error) {
      console.error(`${this.name}: Error getting status:`, error);
      return {
        canMakeRequest: false,
        timeUntilReset: 60000,
        requestsRemaining: 0,
      };
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.requestHistory = [];
  }
}

// Factory function for creating rate limiters
export function createRateLimiter(
  name: string,
  config: RateLimiterConfig
): RateLimiter {
  return new RateLimiter(name, config);
}

// Singleton rate limiters for specific services
class CDIPRateLimiterSingleton {
  private static instance: RateLimiter | null = null;

  private static getInstance(): RateLimiter {
    if (!this.instance) {
      this.instance = new RateLimiter("CDIP", {
        requestsPerMinute: 60, // CDIP allows 60 requests per minute
        requestsPerHour: 3000, // Conservative hourly limit
        burstLimit: 10, // Allow small bursts
      });
    }
    return this.instance;
  }

  static canMakeRequest(): boolean {
    return this.getInstance().canMakeRequest();
  }

  static recordRequest(endpoint?: string): void {
    this.getInstance().recordRequest(endpoint);
  }

  static getTimeUntilReset(): number {
    return this.getInstance().getTimeUntilReset();
  }

  static getStatus(): RateLimitStatus {
    return this.getInstance().getStatus();
  }
}

class NOAARateLimiterSingleton {
  private static instance: RateLimiter | null = null;

  private static getInstance(): RateLimiter {
    if (!this.instance) {
      this.instance = new RateLimiter("NOAA", {
        requestsPerMinute: 300, // NOAA is more generous
        requestsPerHour: 10000, // High hourly limit
        burstLimit: 20, // Allow larger bursts
      });
    }
    return this.instance;
  }

  static canMakeRequest(): boolean {
    return this.getInstance().canMakeRequest();
  }

  static recordRequest(endpoint?: string): void {
    this.getInstance().recordRequest(endpoint);
  }

  static getTimeUntilReset(): number {
    return this.getInstance().getTimeUntilReset();
  }

  static getStatus(): RateLimitStatus {
    return this.getInstance().getStatus();
  }
}

// Export singleton instances
export const CDIPRateLimiter = CDIPRateLimiterSingleton;
export const NOAARateLimiter = NOAARateLimiterSingleton;

// Utility function to wait for rate limit reset
export async function waitForRateLimit(
  rateLimiter: RateLimiter | typeof CDIPRateLimiter | typeof NOAARateLimiter
): Promise<void> {
  if (rateLimiter.canMakeRequest()) {
    return;
  }

  const waitTime = rateLimiter.getTimeUntilReset();
  if (waitTime > 0) {
    console.log(`Rate limit exceeded, waiting ${waitTime}ms...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

// Advanced rate limiting with exponential backoff
export class AdvancedRateLimiter extends RateLimiter {
  private failureCount = 0;
  private lastFailureTime = 0;

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  resetFailures(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  getBackoffDelay(): number {
    if (this.failureCount === 0) return 0;

    // Exponential backoff: 2^failures * 1000ms, max 5 minutes
    const delay = Math.min(
      Math.pow(2, this.failureCount) * 1000,
      5 * 60 * 1000
    );
    const timeSinceFailure = Date.now() - this.lastFailureTime;

    return Math.max(0, delay - timeSinceFailure);
  }

  canMakeRequest(): boolean {
    // Check backoff delay first
    const backoffDelay = this.getBackoffDelay();
    if (backoffDelay > 0) {
      return false;
    }

    return super.canMakeRequest();
  }
}

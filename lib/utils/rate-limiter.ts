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

/**
 * Generic singleton wrapper interface for rate limiters
 */
export interface RateLimiterSingleton {
  canMakeRequest(): boolean;
  recordRequest(endpoint?: string): void;
  getTimeUntilReset(): number;
  getStatus(): RateLimitStatus;
}

/**
 * Creates a singleton wrapper for a rate limiter with the specified configuration.
 * This eliminates code duplication by providing a generic factory function.
 *
 * @param name - The name of the service for logging
 * @param config - Rate limiter configuration
 * @returns A singleton wrapper object with static-like methods
 */
function createRateLimiterSingleton(
  name: string,
  config: RateLimiterConfig
): RateLimiterSingleton {
  let instance: RateLimiter | null = null;

  const getInstance = (): RateLimiter => {
    if (!instance) {
      instance = new RateLimiter(name, config);
    }
    return instance;
  };

  return {
    canMakeRequest(): boolean {
      return getInstance().canMakeRequest();
    },
    recordRequest(endpoint?: string): void {
      getInstance().recordRequest(endpoint);
    },
    getTimeUntilReset(): number {
      return getInstance().getTimeUntilReset();
    },
    getStatus(): RateLimitStatus {
      return getInstance().getStatus();
    },
  };
}

// Service-specific singleton rate limiters
export const CDIPRateLimiter = createRateLimiterSingleton("CDIP", {
  requestsPerMinute: 60, // CDIP allows 60 requests per minute
  requestsPerHour: 3000, // Conservative hourly limit
  burstLimit: 10, // Allow small bursts
});

export const NOAARateLimiter = createRateLimiterSingleton("NOAA", {
  requestsPerMinute: 300, // NOAA is more generous
  requestsPerHour: 10000, // High hourly limit
  burstLimit: 20, // Allow larger bursts
});

// Utility function to wait for rate limit reset
async function waitForRateLimit(
  rateLimiter: RateLimiter | RateLimiterSingleton
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


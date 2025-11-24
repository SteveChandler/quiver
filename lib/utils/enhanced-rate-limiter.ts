/**
 * Enhanced Rate Limiter with Per-Identifier Tracking
 *
 * Extends the base rate limiter to support per-IP/per-user tracking
 * for API endpoint protection in serverless environments.
 *
 * Key features:
 * - Per-identifier rate limiting (IP-based or user-based)
 * - Automatic cleanup to prevent memory leaks
 * - Burst protection
 * - Detailed retry-after calculations
 * - Production-ready for Vercel serverless
 *
 * Architecture: docs/architecture/RATE_LIMITING_ARCHITECTURE.md
 */

import { RateLimiterConfig, RateLimitStatus } from "@/types/forecast";

interface RequestRecord {
  timestamp: number;
  endpoint?: string;
}

/**
 * Enhanced Rate Limiter with per-identifier tracking
 *
 * Each identifier (IP address or user ID) gets its own rate limit tracking.
 * This allows fair resource allocation across different users.
 */
export class EnhancedRateLimiter {
  private requestHistory: Map<string, RequestRecord[]> = new Map();
  private burstCooldowns: Map<string, number> = new Map();
  private rapidTrackers: Map<string, { lastTs: number; streak: number }> = new Map();
  private warmupRequestCounts: Map<string, number> = new Map();
  private readonly config: RateLimiterConfig;
  private readonly name: string;
  private cleanupInterval?: NodeJS.Timeout;
  private lastCleanup: number = Date.now();
  private readonly initializedAt: number = Date.now();

  constructor(name: string, config: RateLimiterConfig) {
    this.name = name;
    this.config = this.validateConfig(config);
    this.startCleanupInterval();
  }

  private validateConfig(config: RateLimiterConfig): RateLimiterConfig {
    return {
      requestsPerMinute: Math.max(1, config.requestsPerMinute || 60),
      requestsPerHour: Math.max(1, config.requestsPerHour || 1000),
      burstLimit: Math.max(1, config.burstLimit || 5),
      burstWindowMs: Math.max(1000, config.burstWindowMs || 60 * 1000),
      warmupRequests: Math.max(0, config.warmupRequests || 0),
      softBurstRecovery: Boolean(config.softBurstRecovery),
    };
  }

  private startCleanupInterval(): void {
    // Only start interval in Node.js environments
    if (typeof setInterval !== "undefined") {
      // Run cleanup every 5 minutes to prevent memory leaks
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldRequests();
      }, 5 * 60 * 1000);

      // Prevent interval from keeping process alive
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Clean up old request history to prevent memory leaks
   *
   * Removes request records older than 1 hour
   * Also removes identifiers with no recent requests
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Track cleanup for monitoring
    const beforeSize = this.requestHistory.size;

    // Clean up each identifier's request history
    for (const [identifier, records] of this.requestHistory.entries()) {
      // Filter out old requests
      const recentRecords = records.filter(
        (record) => record.timestamp > oneHourAgo
      );

      if (recentRecords.length === 0) {
        // No recent requests - remove this identifier entirely
        this.requestHistory.delete(identifier);
        this.burstCooldowns.delete(identifier);
        this.rapidTrackers.delete(identifier);
      } else if (recentRecords.length < records.length) {
        // Some old requests - update with filtered list
        this.requestHistory.set(identifier, recentRecords);
      }
    }

    const afterSize = this.requestHistory.size;
    this.lastCleanup = now;

    if (beforeSize !== afterSize) {
      console.log(
        `[${this.name}] Cleanup: ${beforeSize} → ${afterSize} identifiers`
      );
    }
  }

  /**
   * Check if a request can be made within rate limits
   *
   * @param identifier - Unique identifier (IP address or user ID)
   * @returns true if request is allowed, false if rate limited
   */
  canMakeRequest(identifier: string): boolean {
    try {
      const now = Date.now();
      const records = this.requestHistory.get(identifier) || [];

      const totalRequests = this.warmupRequestCounts.get(identifier) ?? 0;
      if (
        this.config.warmupDurationMs &&
        now - this.initializedAt < this.config.warmupDurationMs
      ) {
        return true;
      }

      // Rapid streak detection (aggressive spam bursts)
      if (this.config.rapidStreakLimit && this.config.rapidThresholdMs) {
        const tracker =
          this.rapidTrackers.get(identifier) || { lastTs: 0, streak: 0 };
        if (tracker.lastTs && now - tracker.lastTs < this.config.rapidThresholdMs) {
          tracker.streak += 1;
        } else {
          tracker.streak = 1;
        }
        tracker.lastTs = now;
        this.rapidTrackers.set(identifier, tracker);

        if (tracker.streak >= this.config.rapidStreakLimit) {
          const cooldownUntil =
            now + (this.config.rapidCooldownMs ?? this.config.rapidThresholdMs * this.config.rapidStreakLimit!);
          this.burstCooldowns.set(identifier, cooldownUntil);
          tracker.streak = 0;
          this.rapidTrackers.set(identifier, tracker);
          return false;
        }
      }

      // Check burst limit (requests within configured window)
      const burstWindow = this.config.burstWindowMs ?? 60 * 1000;
      const recentRequests = records.filter(
        (record) => record.timestamp > now - burstWindow
      );

      if (recentRequests.length >= this.config.burstLimit) {
        const oldestInBurst = Math.min(...recentRequests.map((r) => r.timestamp));
        const resetTime = oldestInBurst + burstWindow;
        this.burstCooldowns.set(identifier, resetTime);
        if (this.config.softBurstRecovery) {
          const trimmed = recentRequests.slice(
            Math.max(0, recentRequests.length - (this.config.burstLimit - 1))
          );
          this.requestHistory.set(identifier, trimmed);
        }
        console.warn(
          `[${this.name}] Burst limit exceeded for ${this.maskIdentifier(identifier)} ` +
            `(${recentRequests.length}/${this.config.burstLimit})`
        );
        return false;
      }

      // Check per-minute limit
      const oneMinuteAgo = now - 60 * 1000;
      const requestsLastMinute = records.filter(
        (record) => record.timestamp > oneMinuteAgo
      );

      if (requestsLastMinute.length >= this.config.requestsPerMinute) {
        console.warn(
          `[${this.name}] Per-minute limit exceeded for ${this.maskIdentifier(identifier)} ` +
            `(${requestsLastMinute.length}/${this.config.requestsPerMinute})`
        );
        return false;
      }

      // Check per-hour limit
      const oneHourAgo = now - 60 * 60 * 1000;
      const requestsLastHour = records.filter(
        (record) => record.timestamp > oneHourAgo
      );

      if (requestsLastHour.length >= this.config.requestsPerHour) {
        console.warn(
          `[${this.name}] Per-hour limit exceeded for ${this.maskIdentifier(identifier)} ` +
            `(${requestsLastHour.length}/${this.config.requestsPerHour})`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[${this.name}] Error checking rate limit:`, error);
      // Fail closed - deny request on error
      return false;
    }
  }

  /**
   * Record a new request for an identifier
   *
   * @param identifier - Unique identifier (IP address or user ID)
   * @param endpoint - Optional endpoint name for logging
   */
  recordRequest(identifier: string, endpoint?: string): void {
    try {
      const now = Date.now();
      const records = this.requestHistory.get(identifier) || [];

      records.push({
        timestamp: now,
        endpoint,
      });

      this.requestHistory.set(identifier, records);


      // Trigger immediate cleanup if history gets too large
      // This prevents memory issues during high traffic
      if (this.requestHistory.size > 1000) {
        const timeSinceCleanup = now - this.lastCleanup;
        if (timeSinceCleanup > 60 * 1000) {
          // At least 1 minute since last cleanup
          this.cleanupOldRequests();
        }
      }
    } catch (error) {
      console.error(`[${this.name}] Error recording request:`, error);
    }
  }

  /**
   * Get time until rate limit resets (in seconds)
   *
   * @param identifier - Unique identifier
   * @returns Seconds until the rate limit resets
   */
  getRetryAfter(identifier: string): number {
    try {
      const now = Date.now();
      const records = this.requestHistory.get(identifier) || [];

       const cooldownUntil = this.burstCooldowns.get(identifier);
       if (cooldownUntil) {
         if (cooldownUntil <= now) {
           this.burstCooldowns.delete(identifier);
         } else {
           return Math.ceil((cooldownUntil - now) / 1000);
         }
       }

      // Check which limit was hit and return appropriate retry time

      // Check per-minute limit
      const oneMinuteAgo = now - 60 * 1000;
      const requestsLastMinute = records.filter(
        (record) => record.timestamp > oneMinuteAgo
      );

      if (requestsLastMinute.length >= this.config.requestsPerMinute) {
        // Find oldest request in the last minute
        const oldestInMinute = Math.min(
          ...requestsLastMinute.map((r) => r.timestamp)
        );
        const resetTime = oldestInMinute + 60 * 1000;
        return Math.max(1, Math.ceil((resetTime - now) / 1000));
      }

      // Check burst limit
      const burstWindow = this.config.burstWindowMs ?? 60 * 1000;
      const recentRequests = records.filter(
        (record) => record.timestamp > now - burstWindow
      );

      if (recentRequests.length >= this.config.burstLimit) {
        const oldestInBurst = Math.min(
          ...recentRequests.map((r) => r.timestamp)
        );
        const resetTime = oldestInBurst + burstWindow;
        return Math.max(1, Math.ceil((resetTime - now) / 1000));
      }

      // Check per-hour limit (less common)
      const oneHourAgo = now - 60 * 60 * 1000;
      const requestsLastHour = records.filter(
        (record) => record.timestamp > oneHourAgo
      );

      if (requestsLastHour.length >= this.config.requestsPerHour) {
        const oldestInHour = Math.min(
          ...requestsLastHour.map((r) => r.timestamp)
        );
        const resetTime = oldestInHour + 60 * 60 * 1000;
        return Math.max(1, Math.ceil((resetTime - now) / 1000));
      }

      return 0;
    } catch (error) {
      console.error(`[${this.name}] Error calculating retry-after:`, error);
      return 60; // Default to 1 minute
    }
  }

  /**
   * Get current rate limit status for an identifier
   *
   * @param identifier - Unique identifier
   * @returns Rate limit status with remaining requests
   */
  getStatus(identifier: string): RateLimitStatus {
    try {
      const now = Date.now();
      const records = this.requestHistory.get(identifier) || [];
      const oneMinuteAgo = now - 60 * 1000;
      const requestsLastMinute = records.filter(
        (record) => record.timestamp > oneMinuteAgo
      ).length;

      return {
        canMakeRequest: this.canMakeRequest(identifier),
        timeUntilReset: this.getRetryAfter(identifier) * 1000, // Convert to ms
        requestsRemaining: Math.max(
          0,
          this.config.requestsPerMinute - requestsLastMinute
        ),
      };
    } catch (error) {
      console.error(`[${this.name}] Error getting status:`, error);
      return {
        canMakeRequest: false,
        timeUntilReset: 60000,
        requestsRemaining: 0,
      };
    }
  }

  /**
   * Mask identifier for privacy-compliant logging
   *
   * @param identifier - IP address or user ID
   * @returns Masked identifier (e.g., 192.168.1.x)
   */
  private maskIdentifier(identifier: string): string {
    // Mask IP addresses for privacy (GDPR compliance)
    if (identifier.includes(".")) {
      // IPv4
      const parts = identifier.split(".");
      return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
    } else if (identifier.includes(":")) {
      // IPv6
      const parts = identifier.split(":");
      return `${parts[0]}:${parts[1]}:xxxx`;
    }
    // User IDs - mask last characters
    return identifier.substring(0, 8) + "...";
  }

  /**
   * Get diagnostic information about the rate limiter
   *
   * Useful for debugging and monitoring
   */
  getDiagnostics(): {
    name: string;
    config: RateLimiterConfig;
    activeIdentifiers: number;
    totalRequests: number;
    lastCleanup: string;
  } {
    let totalRequests = 0;
    for (const records of this.requestHistory.values()) {
      totalRequests += records.length;
    }

    return {
      name: this.name,
      config: this.config,
      activeIdentifiers: this.requestHistory.size,
      totalRequests,
      lastCleanup: new Date(this.lastCleanup).toISOString(),
    };
  }

  /**
   * Clean up resources
   *
   * Call this when the rate limiter is no longer needed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.requestHistory.clear();
  }
}

/**
 * Factory function for creating enhanced rate limiters
 *
 * @param name - Limiter name for logging
 * @param config - Rate limiter configuration
 * @returns EnhancedRateLimiter instance
 */
export function createEnhancedRateLimiter(
  name: string,
  config: RateLimiterConfig
): EnhancedRateLimiter {
  return new EnhancedRateLimiter(name, config);
}

/**
 * Singleton cache for rate limiters
 *
 * Ensures we only create one rate limiter instance per configuration key
 * This is important for serverless environments where modules may be reloaded
 */
const rateLimiterCache = new Map<string, EnhancedRateLimiter>();

/**
 * Get or create a cached rate limiter instance
 *
 * @param name - Limiter name (should be unique)
 * @param config - Rate limiter configuration
 * @returns Cached or new EnhancedRateLimiter instance
 */
export function getCachedRateLimiter(
  name: string,
  config: RateLimiterConfig
): EnhancedRateLimiter {
  if (!rateLimiterCache.has(name)) {
    rateLimiterCache.set(name, new EnhancedRateLimiter(name, config));
  }
  return rateLimiterCache.get(name)!;
}

/**
 * Clear all cached rate limiters
 *
 * Useful for testing and cleanup
 */
export function clearRateLimiterCache(): void {
  for (const limiter of rateLimiterCache.values()) {
    limiter.destroy();
  }
  rateLimiterCache.clear();
}

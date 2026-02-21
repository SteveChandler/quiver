/**
 * Rate Limit Telemetry and Monitoring
 *
 * Provides logging and monitoring for rate limit violations.
 * Helps detect attacks, tune limits, and understand usage patterns.
 */

import { RateLimiterConfig } from "@/types/forecast";
import { RateLimitKey } from "@/lib/api/rate-limit-config";

/**
 * Rate limit violation event
 */
interface RateLimitViolation {
  endpoint: RateLimitKey;
  identifier: string; // Masked for privacy
  timestamp: string;
  config: RateLimiterConfig;
  userAgent?: string;
  path?: string;
}

/**
 * Mask IP address for privacy compliance (GDPR)
 *
 * @param identifier - IP address or user ID
 * @returns Masked identifier
 */
function maskIdentifier(identifier: string): string {
  if (identifier.includes(".")) {
    // IPv4 - mask last octet
    const parts = identifier.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  } else if (identifier.includes(":")) {
    // IPv6 - mask last segments
    const parts = identifier.split(":");
    return `${parts[0]}:${parts[1]}:xxxx`;
  }
  // User ID - mask end
  return identifier.length > 8
    ? identifier.substring(0, 8) + "..."
    : "user-xxx";
}

/**
 * Log a rate limit violation
 *
 * Logs to console and can be extended to send to Sentry or other
 * monitoring services for alerting.
 *
 * @param endpoint - Which endpoint was rate limited
 * @param identifier - Client IP or user ID (will be masked)
 * @param config - Rate limit configuration that was violated
 * @param userAgent - Optional user agent string
 * @param path - Optional request path
 */
export function logRateLimitViolation(
  endpoint: RateLimitKey,
  identifier: string,
  config?: RateLimiterConfig,
  userAgent?: string,
  path?: string
): void {
  const violation: RateLimitViolation = {
    endpoint,
    identifier: maskIdentifier(identifier),
    timestamp: new Date().toISOString(),
    config: config || {
      requestsPerMinute: 0,
      requestsPerHour: 0,
      burstLimit: 0,
    },
    userAgent,
    path,
  };

  // Console logging (always)
  console.warn("[RATE_LIMIT_VIOLATION]", {
    endpoint: violation.endpoint,
    identifier: violation.identifier,
    timestamp: violation.timestamp,
    limits: {
      perMinute: violation.config.requestsPerMinute,
      perHour: violation.config.requestsPerHour,
      burst: violation.config.burstLimit,
    },
    ...(userAgent && { userAgent }),
    ...(path && { path }),
  });

  // Detect potential attacks - multiple violations in short time
  detectPotentialAttack(endpoint, identifier);
}

/**
 * Track recent violations for attack detection
 *
 * Maps endpoint+identifier to violation timestamps
 */
const recentViolations = new Map<
  string,
  { count: number; firstViolation: number }
>();

/**
 * Detect potential DoS/DDoS attacks
 *
 * If the same identifier has multiple violations within a short time,
 * it might indicate an attack. Log at higher severity.
 *
 * @param endpoint - Endpoint being targeted
 * @param identifier - Client identifier (masked)
 */
function detectPotentialAttack(endpoint: RateLimitKey, identifier: string): void {
  const key = `${endpoint}:${maskIdentifier(identifier)}`;
  const now = Date.now();
  const attackWindow = 5 * 60 * 1000; // 5 minutes

  const existing = recentViolations.get(key);

  if (existing) {
    const timeSinceFirst = now - existing.firstViolation;

    if (timeSinceFirst < attackWindow) {
      existing.count++;

      // Threshold: 5 violations within 5 minutes = potential attack
      if (existing.count >= 5) {
        console.error("[POTENTIAL_ATTACK_DETECTED]", {
          endpoint,
          identifier: maskIdentifier(identifier),
          violations: existing.count,
          timeWindow: timeSinceFirst,
          timestamp: new Date().toISOString(),
        });

        // Reset counter to avoid spam
        recentViolations.delete(key);
      }
    } else {
      // Outside attack window - reset
      recentViolations.set(key, { count: 1, firstViolation: now });
    }
  } else {
    // First violation for this identifier
    recentViolations.set(key, { count: 1, firstViolation: now });
  }

  // Cleanup old entries to prevent memory leaks
  cleanupOldViolations();
}

/**
 * Clean up old violation tracking data
 *
 * Removes entries older than 1 hour to prevent memory leaks
 */
function cleanupOldViolations(): void {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  for (const [key, data] of recentViolations.entries()) {
    if (data.firstViolation < oneHourAgo) {
      recentViolations.delete(key);
    }
  }
}

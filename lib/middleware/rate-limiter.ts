/**
 * Rate Limiting Middleware
 *
 * Provides a clean wrapper for applying rate limiting to API routes.
 * Automatically handles:
 * - Client identification (IP-based)
 * - Rate limit checking
 * - 429 responses with Retry-After headers
 * - Request recording
 * - Violation logging
 *
 * Usage:
 * ```typescript
 * import { withRateLimit } from '@/lib/middleware/rate-limiter';
 *
 * async function handler(request: NextRequest) {
 *   // Your endpoint logic
 * }
 *
 * export const GET = withRateLimit(handler, 'beach-search');
 * ```
 *
 * Architecture: docs/architecture/RATE_LIMITING_ARCHITECTURE.md
 */

import { NextRequest, NextResponse } from "next/server";
import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import {
  RATE_LIMITS,
  type RateLimitKey,
  getRateLimitMessage,
} from "@/lib/api/rate-limit-config";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { logRateLimitViolation } from "@/lib/monitoring/rate-limit-telemetry";
import { withBotBlocking } from "@/lib/middleware/bot-blocker";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

/**
 * Extract client identifier from request
 *
 * Uses Vercel's forwarded headers to get the real client IP
 * Falls back to x-real-ip if x-forwarded-for is not available
 *
 * @param request - Next.js request object
 * @returns Client IP address or 'unknown'
 */
export function getClientIdentifier(request: NextRequest): string {
  // Vercel provides x-forwarded-for with comma-separated list of IPs
  // The first IP is the client, subsequent IPs are proxies
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0].trim();
    if (clientIp) return clientIp;
  }

  // Fallback to x-real-ip
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  // Last resort fallback (should rarely happen on Vercel)
  return "unknown";
}

/**
 * Rate limiting middleware wrapper
 *
 * Wraps an API route handler with rate limiting protection.
 * Automatically checks rate limits, returns 429 responses,
 * and records successful requests.
 *
 * @param handler - The actual API route handler function
 * @param limitKey - Which rate limit configuration to apply
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```typescript
 * async function searchHandler(request: NextRequest) {
 *   const results = await searchBeaches(query);
 *   return createSuccessResponse(results);
 * }
 *
 * export const GET = withRateLimit(searchHandler, 'beach-search');
 * ```
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limitKey: RateLimitKey
): (req: NextRequest) => Promise<NextResponse> {
  // Get rate limiter instance (cached for performance)
  const limiter = getCachedRateLimiter(limitKey, RATE_LIMITS[limitKey]);

  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Extract client identifier
      const identifier = getClientIdentifier(req);

      // Check rate limit
      if (!limiter.canMakeRequest(identifier)) {
        // Rate limit exceeded - calculate retry time
        const retryAfterSeconds = Math.max(1, limiter.getRetryAfter(identifier));

        // Log violation for monitoring
        logRateLimitViolation(limitKey, identifier, RATE_LIMITS[limitKey]);

        // Return 429 Too Many Requests
        return NextResponse.json(
          {
            success: false,
            error: getRateLimitMessage(limitKey),
            retryAfter: retryAfterSeconds,
            timestamp: new Date().toISOString(),
          },
          {
            status: 429,
            headers: {
              ...DEFAULT_SECURITY_HEADERS,
              "Retry-After": retryAfterSeconds.toString(),
              // Add rate limit info headers (informational)
              "X-RateLimit-Limit": RATE_LIMITS[limitKey].requestsPerMinute.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": new Date(
                Date.now() + retryAfterSeconds * 1000
              ).toISOString(),
            },
          }
        );
      }

      // Record the request (before handling to prevent race conditions)
      limiter.recordRequest(identifier, req.nextUrl.pathname);

      // Get current status for response headers
      const status = limiter.getStatus(identifier);

      // Call the actual handler
      const response = await handler(req);

      // Add rate limit info headers to successful responses
      // This helps clients understand their limits
      response.headers.set(
        "X-RateLimit-Limit",
        RATE_LIMITS[limitKey].requestsPerMinute.toString()
      );
      response.headers.set(
        "X-RateLimit-Remaining",
        status.requestsRemaining.toString()
      );

      if (status.timeUntilReset > 0) {
        response.headers.set(
          "X-RateLimit-Reset",
          new Date(Date.now() + status.timeUntilReset).toISOString()
        );
      }

      if (DEFAULT_SECURITY_HEADERS["Referrer-Policy"]) {
        response.headers.set(
          "Referrer-Policy",
          DEFAULT_SECURITY_HEADERS["Referrer-Policy"]
        );
      }

      return response;
    } catch (error) {
      console.error(`[RateLimit:${limitKey}] Unexpected error:`, error);

      // On error, allow the request through but log the issue
      // This ensures rate limiting failures don't break the API
      console.warn(`[RateLimit:${limitKey}] Allowing request due to rate limiter error`);

      return await handler(req);
    }
  };
}

/**
 * Optional: Rate limit with authentication bypass
 *
 * For endpoints that should have different limits for authenticated users
 * Currently not used, but can be implemented if needed
 *
 * @param handler - API route handler
 * @param publicLimitKey - Rate limit for unauthenticated requests
 * @param authenticatedLimitKey - Rate limit for authenticated requests
 */
export function withAuthAwareRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  publicLimitKey: RateLimitKey,
  authenticatedLimitKey: RateLimitKey
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    let isAuthenticated = false;

    try {
      const supabase = createAPIServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (user && !error) {
        isAuthenticated = true;
      }
    } catch (err) {
      // If auth check fails, default to unauthenticated (safe default)
      console.error("Auth check failed in rate limiter:", err);
      isAuthenticated = false;
    }

    const limitKey = isAuthenticated ? authenticatedLimitKey : publicLimitKey;

    return withRateLimit(handler, limitKey)(req);
  };
}

/**
 * Get rate limiter diagnostics for monitoring
 *
 * Useful for debugging and understanding rate limiter state
 *
 * @param limitKey - Rate limit configuration key
 * @returns Diagnostic information
 */
export function getRateLimiterDiagnostics(limitKey: RateLimitKey) {
  const limiter = getCachedRateLimiter(limitKey, RATE_LIMITS[limitKey]);
  return limiter.getDiagnostics();
}

/**
 * Combined bot blocking and rate limiting wrapper
 *
 * Applies bot detection first (fast, string matching), then rate limiting.
 * Use this for public API endpoints that are vulnerable to bot traffic.
 *
 * Bot blocking happens before rate limiting because:
 * 1. It's faster (no state lookup required)
 * 2. Blocks bots before they consume rate limit quota
 * 3. Reduces load on rate limiter
 *
 * @param handler - The API route handler
 * @param limitKey - Rate limit configuration key
 * @returns Wrapped handler with bot blocking and rate limiting
 *
 * @example
 * ```typescript
 * import { withBotBlockingAndRateLimit } from '@/lib/middleware/rate-limiter';
 *
 * async function handler(request: NextRequest) {
 *   // Your endpoint logic
 * }
 *
 * export const GET = withBotBlockingAndRateLimit(handler, 'public-default');
 * ```
 */
export function withBotBlockingAndRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limitKey: RateLimitKey
): (req: NextRequest) => Promise<NextResponse> {
  // Apply bot blocking first (blocks immediately, no state lookup)
  // Then apply rate limiting (checks/records request counts)
  return withBotBlocking(withRateLimit(handler, limitKey));
}

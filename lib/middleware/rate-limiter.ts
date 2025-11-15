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
        const retryAfterSeconds = limiter.getRetryAfter(identifier);

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
    // TODO: Check if user is authenticated
    // For now, always use public limits
    // In the future, we can extract user ID from auth headers
    // and apply authenticated limits

    const isAuthenticated = false; // TODO: Implement auth check
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

/**
 * Rate Limiting Middleware
 *
 * DEPRECATED: This file is maintained for backward compatibility.
 * New code should import from '@/lib/middleware/api-wrappers' instead.
 *
 * @deprecated Use `import { withRateLimit, withBotBlockingAndRateLimit } from '@/lib/middleware/api-wrappers'`
 *
 * All exports are re-exported from api-wrappers.ts for backward compatibility.
 * Existing imports will continue to work:
 *
 * ```typescript
 * // Old import (still works)
 * import { withBotBlockingAndRateLimit } from '@/lib/middleware/rate-limiter';
 *
 * // New recommended import
 * import { withBotBlockingAndRateLimit } from '@/lib/middleware/api-wrappers';
 * ```
 *
 * Documentation: docs/API_MIDDLEWARE.md (developer guide)
 * Reference: docs/API_MIDDLEWARE_REFERENCE.md (technical details)
 */

// Re-export everything from api-wrappers for backward compatibility
export {
  withRateLimit,
  withBotBlockingAndRateLimit,
  withProtection,
  withAuthAndRateLimit,
  withFullProtection,
  getClientIdentifier,
  type WithRateLimitOptions,
  type ProtectionOptions,
} from "@/lib/middleware/api-wrappers";

// Re-export types that may be needed
export type { RateLimitKey } from "@/lib/api/rate-limit-config";

// Legacy functions that may still be needed for diagnostics
import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import { RATE_LIMITS, type RateLimitKey } from "@/lib/api/rate-limit-config";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

/**
 * Optional: Rate limit with authentication bypass
 *
 * For endpoints that should have different limits for authenticated users.
 * NOTE: Consider using withProtection() with auth.optional instead for new code.
 *
 * @deprecated Use withProtection() with authAware rate limiting options
 */
export function withAuthAwareRateLimit(
  handler: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>,
  publicLimitKey: RateLimitKey,
  authenticatedLimitKey: RateLimitKey
): (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse> {
  return async (req) => {
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
      console.error("Auth check failed in rate limiter:", err);
      isAuthenticated = false;
    }

    const limitKey = isAuthenticated ? authenticatedLimitKey : publicLimitKey;

    const { withRateLimit } = await import("@/lib/middleware/api-wrappers");
    return withRateLimit(handler, { key: limitKey })(req);
  };
}

/**
 * Get rate limiter diagnostics for monitoring
 *
 * Useful for debugging and understanding rate limiter state.
 *
 * @param limitKey - Rate limit configuration key
 * @returns Diagnostic information
 */
export function getRateLimiterDiagnostics(limitKey: RateLimitKey) {
  const limiter = getCachedRateLimiter(limitKey, RATE_LIMITS[limitKey]);
  return limiter.getDiagnostics();
}

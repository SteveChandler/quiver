/**
 * Rate Limiting Wrapper
 *
 * Provides rate limiting protection for API route handlers.
 * Supports both static and auth-aware rate limiting.
 *
 * CRITICAL: This file contains a TDZ (Temporal Dead Zone) fix that MUST be preserved.
 * The `let resolvedLimitKey` variable is declared in the outer scope before the try block
 * to avoid a ReferenceError in the catch path if resolution fails mid-await.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { withBotBlocking } from "@/lib/middleware/bot-blocker";
import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import {
  RATE_LIMITS,
  type RateLimitKey,
  getRateLimitMessage,
} from "@/lib/api/rate-limit-config";
import { logRateLimitViolation } from "@/lib/monitoring/rate-limit-telemetry";
import type { RouteHandler, RouteContext, WithRateLimitOptions } from "./types";

/**
 * Extract client identifier from request for rate limiting
 *
 * Uses Vercel's forwarded headers to get the real client IP.
 * Falls back to x-real-ip if x-forwarded-for is not available.
 *
 * @param request - Next.js request object
 * @returns Client IP address or 'unknown'
 */
export function getClientIdentifier(request: NextRequest): string {
  // Prefer platform-provided headers when available.
  // `x-vercel-forwarded-for` is set by Vercel's edge and is harder to spoof than
  // client-supplied `x-forwarded-for`.
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const clientIp = vercelForwardedFor.split(",")[0]?.trim();
    if (clientIp) return clientIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0]?.trim();
    if (clientIp) return clientIp;
  }

  return "unknown";
}

/**
 * Rate limiting middleware wrapper
 *
 * Wraps an API route handler with rate limiting protection.
 * Automatically handles 429 responses with Retry-After headers.
 *
 * @param handler - The actual API route handler function
 * @param options - Rate limit configuration (or string key for backward compatibility)
 * @returns Wrapped handler with rate limiting
 *
 * @example New style
 * ```ts
 * export const GET = withRateLimit(handler, { key: 'public-default' });
 * ```
 *
 * @example Backward compatible
 * ```ts
 * export const GET = withRateLimit(handler, 'public-default');
 * ```
 */
export function withRateLimit(
  handler: RouteHandler,
  options: WithRateLimitOptions | RateLimitKey
): RouteHandler {
  // Handle backward-compatible string format
  const normalized: WithRateLimitOptions =
    typeof options === "string" ? { key: options } : options;

  if (!normalized.key && !normalized.authAware) {
    throw new Error(
      "withRateLimit requires either options.key or options.authAware"
    );
  }

  if (normalized.authAware && typeof normalized.authAware !== "object") {
    throw new Error(
      "withRateLimit: authAware must be an object with { publicLimitKey, authenticatedLimitKey }, not a boolean"
    );
  }

  const staticLimitKey: RateLimitKey | null = normalized.authAware
    ? null
    : (normalized.key as RateLimitKey);
  const staticLimiter =
    staticLimitKey != null
      ? getCachedRateLimiter(staticLimitKey, RATE_LIMITS[staticLimitKey])
      : null;

  return async (request: NextRequest, context?: RouteContext) => {
    // NOTE: Keep limit key in an outer scope so the catch path never touches a TDZ
    // `const limitKey` (which can throw a ReferenceError if resolution fails mid-await).
    let resolvedLimitKey: RateLimitKey | undefined;
    try {
      const identifier = getClientIdentifier(request);

      resolvedLimitKey =
        staticLimitKey ??
        (await (async () => {
          if (!normalized.authAware) {
            return normalized.key as RateLimitKey;
          }

          // Auth-aware selection: choose key based on auth status.
          // This adds overhead (auth check) but is required for adaptive limits.
          try {
            const supabase = await createSupabaseServerClient();
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser();

            return user && !error
              ? normalized.authAware.authenticatedLimitKey
              : normalized.authAware.publicLimitKey;
          } catch {
            // On auth detection failure, fall back to public limits.
            return normalized.authAware.publicLimitKey;
          }
        })());

      const limiter =
        staticLimiter ??
        getCachedRateLimiter(resolvedLimitKey, RATE_LIMITS[resolvedLimitKey]);

      if (!limiter.canMakeRequest(identifier)) {
        const retryAfterSeconds = Math.max(1, limiter.getRetryAfter(identifier));

        logRateLimitViolation(
          resolvedLimitKey,
          identifier,
          RATE_LIMITS[resolvedLimitKey]
        );

        return NextResponse.json(
          {
            success: false,
            error: getRateLimitMessage(resolvedLimitKey),
            retryAfter: retryAfterSeconds,
            timestamp: new Date().toISOString(),
          },
          {
            status: 429,
            headers: {
              ...DEFAULT_SECURITY_HEADERS,
              "Retry-After": retryAfterSeconds.toString(),
              "X-RateLimit-Limit":
                RATE_LIMITS[resolvedLimitKey].requestsPerMinute.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": new Date(
                Date.now() + retryAfterSeconds * 1000
              ).toISOString(),
            },
          }
        );
      }

      limiter.recordRequest(identifier, request.nextUrl.pathname);
      const status = limiter.getStatus(identifier);

      const response = await handler(request, context);

      response.headers.set(
        "X-RateLimit-Limit",
        RATE_LIMITS[resolvedLimitKey].requestsPerMinute.toString()
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
      const keyLabel = resolvedLimitKey ?? "unknown";
      console.error(`[RateLimit:${keyLabel}] Unexpected error:`, error);

      // Fail closed: if rate limiting infrastructure fails, block the request
      // rather than silently allowing potentially abusive traffic.
      const retryAfterSeconds = 30;
      return NextResponse.json(
        {
          success: false,
          error: "Service temporarily unavailable",
          timestamp: new Date().toISOString(),
        },
        {
          status: 503,
          headers: {
            ...DEFAULT_SECURITY_HEADERS,
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }
  };
}

/**
 * Combined bot blocking + rate limiting wrapper
 *
 * Applies bot detection first (fast, string matching), then rate limiting.
 * Use this for public API endpoints vulnerable to bot traffic.
 *
 * @param handler - The API route handler
 * @param options - Rate limit configuration (or string for backward compatibility)
 * @returns Wrapped handler with bot blocking and rate limiting
 *
 * @example New style
 * ```ts
 * export const GET = withBotBlockingAndRateLimit(handler, { key: 'public-default' });
 * ```
 *
 * @example Backward compatible (deprecated)
 * ```ts
 * export const GET = withBotBlockingAndRateLimit(handler, 'public-default');
 * ```
 */
export function withBotBlockingAndRateLimit(
  handler: RouteHandler,
  options: WithRateLimitOptions | RateLimitKey
): RouteHandler {
  // Handle backward-compatible string format
  const rateLimitOptions: WithRateLimitOptions =
    typeof options === "string" ? { key: options } : options;

  return withBotBlocking(withRateLimit(handler, rateLimitOptions));
}

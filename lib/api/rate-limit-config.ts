/**
 * Rate Limit Configuration
 *
 * Defines tiered rate limits for different API endpoint categories.
 * Limits are designed to prevent abuse while allowing legitimate usage.
 *
 * Architecture: docs/architecture/RATE_LIMITING_ARCHITECTURE.md
 */

import { RateLimiterConfig } from "@/types/forecast";

const IS_E2E =
  process.env.PLAYWRIGHT_TEST === "true" ||
  process.env.E2E_RELAX_RATE_LIMITS === "true";
const IS_PRODUCTION = process.env.NODE_ENV === "production" && !IS_E2E;

function relaxForE2E(config: RateLimiterConfig): RateLimiterConfig {
  if (!IS_E2E) return config;

  return {
    ...config,
    burstLimit: 10000,
    rapidStreakLimit: config.rapidStreakLimit ? 10000 : undefined,
    requestsPerHour: 100000,
    requestsPerMinute: 10000,
  };
}

/**
 * Rate limit presets for different endpoint types
 *
 * Limits are based on:
 * - Endpoint cost (database queries, external API calls)
 * - Security risk (SSRF, DoS potential)
 * - Expected legitimate usage patterns
 */
export const RATE_LIMITS = {
  /**
   * Image Proxy - CRITICAL
   *
   * Endpoint: /api/image-proxy
   * Risk: SSRF (Server-Side Request Forgery)
   * Cost: External HTTP requests, bandwidth
   *
   * Very strict limits to prevent abuse
   */
  "image-proxy": relaxForE2E({
    // NOTE:
    // This endpoint is hit by Next.js Image Optimization, which can legitimately
    // issue many parallel requests on a single page load (multiple images, sizes).
    // Keep SSRF protections strict (domain/IP validation), but allow enough burst
    // capacity to avoid broken images during normal browsing.
    requestsPerMinute: 60,
    requestsPerHour: 600,
    burstLimit: 25,
  }),

  /**
   * Recommendations - HIGH
   *
   * Endpoint: /api/v1/recommendations
   * Risk: N+1 query performance issue
   * Cost: Multiple database queries per request
   *
   * Strict limits until N+1 query is optimized
   */
  recommendations: relaxForE2E({
    requestsPerMinute: 20,
    requestsPerHour: 200,
    burstLimit: 5,
  }),

  /**
   * Beach Search - HIGH
   *
   * Endpoint: /api/beaches/search
   * Risk: Expensive multi-table search operations
   * Cost: Full-text search, complex queries
   *
   * Moderate limits for expensive operations
   */
  "beach-search": relaxForE2E({
    requestsPerMinute: 30,
    requestsPerHour: 300,
    burstLimit: 10,
  }),

  /**
   * Forecast Bulk - MEDIUM
   *
   * Endpoint: /api/forecasts/bulk
   * Risk: Bulk data fetching
   * Cost: Large dataset queries
   *
   * Higher limits but still controlled
   */
  "forecast-bulk": relaxForE2E({
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstLimit: 20,
  }),

  /**
   * Coach Picks - MEDIUM
   *
   * Endpoint: /api/coach-picks
   * Risk: Complex RPC calls
   * Cost: Database RPC function execution
   */
  "coach-picks": relaxForE2E({
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstLimit: 20,
  }),

  /**
   * Public Default - MEDIUM
   *
   * Endpoints:
   * - /api/beaches/nearby
   * - /api/beaches/featured
   * - /api/beaches (list)
   * - Other public read endpoints
   *
   * Standard limits for public endpoints
   */
  "public-default": relaxForE2E({
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    // Dev/test environments can issue many parallel requests (maps, image hydration, etc).
    // Keep production strict, but allow larger bursts locally to avoid breaking UX/tests.
    burstLimit: IS_PRODUCTION ? 20 : 200,
  }),

  /**
   * Public Showcase - optimized for marketing endpoints that need
   * higher burst tolerance (e.g., featured beaches) while still
   * enforcing rate limits after an initial warmup period.
   */
  "public-showcase": relaxForE2E({
    requestsPerMinute: 120,
    requestsPerHour: 2000,
    burstLimit: 100,
    burstWindowMs: 60000,
    warmupDurationMs: 1500,
    rapidStreakLimit: 20,
    rapidThresholdMs: 250,
    rapidCooldownMs: 4000,
    softBurstRecovery: true,
  }),

  /**
   * Authenticated Default - LOW
   *
   * For endpoints requiring authentication
   * Higher limits since users are identified
   */
  "authenticated-default": relaxForE2E({
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    burstLimit: 50,
  }),

  /**
   * Account Recovery - CRITICAL
   *
   * Fresh identity proofs are intentionally sparse. Keep both burst and
   * sustained attempt counts low to limit replay and account probing.
   */
  "account-recovery": relaxForE2E({
    requestsPerMinute: 5,
    requestsPerHour: 12,
    burstLimit: 2,
  }),

  /**
   * Surf Discovery - MEDIUM
   *
   * Endpoint: /api/surf/discover
   * Risk: Complex user-specific surf spot discovery
   * Cost: Multiple database queries, scoring algorithm
   *
   * Moderate limits for personalized recommendations
   */
  "surf-discovery": relaxForE2E({
    requestsPerMinute: IS_PRODUCTION ? 15 : 60,
    requestsPerHour: IS_PRODUCTION ? 150 : 600,
    burstLimit: IS_PRODUCTION ? 15 : 30,
  }),

  /**
   * Surf Insights - MEDIUM
   *
   * Endpoint: /api/surf/insights
   * Risk: Complex similarity scoring algorithm
   * Cost: Database queries for user sessions, similarity computation
   *
   * Moderate limits for personalized insights (same as surf-discovery)
   */
  "surf-insights": relaxForE2E({
    requestsPerMinute: IS_PRODUCTION ? 10 : 40,
    requestsPerHour: IS_PRODUCTION ? 100 : 400,
    burstLimit: IS_PRODUCTION ? 3 : 15,
  }),

  /**
   * Webhook - Resend
   *
   * Endpoint: /api/webhooks/resend
   * Risk: External webhook delivery
   * Cost: Single database update per event
   *
   * Higher limits to accommodate burst webhook deliveries
   */
  "webhook-resend": relaxForE2E({
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    burstLimit: 50,
  }),

  /**
   * HLS Proxy - HIGH
   *
   * Endpoint: /api/hls-proxy/[...path]
   * Risk: SSRF, bandwidth abuse (video streaming)
   * Cost: External HTTP requests, high bandwidth per request
   *
   * HLS streams request many segments per minute per viewer.
   * A single viewer ~10-30 req/min. Allow moderate concurrency.
   */
  "hls-proxy": relaxForE2E({
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    burstLimit: 60,
  }),

  /**
   * Cam Resolve - MEDIUM
   *
   * Endpoint: /api/cam-resolve
   * Risk: SSRF (mitigated by hostname whitelist), scraping
   * Cost: External HTTP request per call
   *
   * Resolves HDOnTap page URLs to HLS stream URLs.
   * One call per camera view; signed URLs cached ~2min.
   */
  "cam-resolve": relaxForE2E({
    requestsPerMinute: 30,
    requestsPerHour: 500,
    burstLimit: 10,
  }),

  /**
   * Anon Alert Capture - HIGH abuse risk
   *
   * Endpoint: POST /api/alerts/anon-capture
   * Risk: Email spam / OTP abuse via signInWithOtp
   * Cost: External Supabase Auth call per request
   *
   * Strict 5/hour per IP — anonymous users only need to submit once.
   */
  "anon-alert-capture": relaxForE2E({
    requestsPerMinute: 2,
    requestsPerHour: 5,
    burstLimit: 2,
  }),

  /**
   * Android Beta Lead - anonymous email capture
   *
   * Endpoint: POST /api/android-beta/leads
   * Risk: Email-list abuse / database spam
   * Cost: Single service-role upsert per request
   */
  "android-beta-lead": relaxForE2E({
    requestsPerMinute: 4,
    requestsPerHour: 12,
    burstLimit: 3,
  }),
  "install-attribution-issue": relaxForE2E({
    requestsPerMinute: 6,
    requestsPerHour: 30,
    burstLimit: 3,
  }),
  "install-attribution-redeem": relaxForE2E({
    requestsPerMinute: 12,
    requestsPerHour: 60,
    burstLimit: 4,
  }),
} as const;

/**
 * Type-safe rate limit keys
 */
export type RateLimitKey = keyof typeof RATE_LIMITS;



/**
 * Rate limit documentation for API responses
 */
const RATE_LIMIT_MESSAGES = {
  "image-proxy": "Image proxy rate limit exceeded. Please reduce request frequency.",
  recommendations:
    "Recommendation API rate limit exceeded. Please wait before requesting more recommendations.",
  "beach-search": "Search rate limit exceeded. Please wait before searching again.",
  "forecast-bulk": "Forecast data rate limit exceeded. Please reduce request frequency.",
  "coach-picks": "Coach picks rate limit exceeded. Please wait before retrying.",
  "public-default": "API rate limit exceeded. Please wait before making more requests.",
  "public-showcase":
    "API rate limit exceeded. Please wait before making more requests.",
  "authenticated-default":
    "API rate limit exceeded. Please reduce request frequency.",
  "account-recovery":
    "Too many account recovery attempts. Please wait before trying again.",
  "surf-discovery":
    "Surf discovery rate limit exceeded. Please wait before requesting more recommendations.",
  "surf-insights":
    "Surf insights rate limit exceeded. Please wait before requesting more insights.",
  "webhook-resend":
    "Webhook rate limit exceeded. Events will be retried by Resend.",
  "hls-proxy":
    "HLS proxy rate limit exceeded. Please wait before requesting more streams.",
  "cam-resolve":
    "Camera stream resolution rate limit exceeded. Please wait before retrying.",
  "anon-alert-capture":
    "Too many alert sign-up attempts. Please wait before retrying.",
  "android-beta-lead":
    "Too many Android beta sign-up attempts. Please wait before retrying.",
  "install-attribution-issue":
    "Too many install attribution requests. Please wait before trying again.",
  "install-attribution-redeem":
    "Too many install attribution redemptions. Please wait before retrying.",
} as const;

/**
 * Get user-friendly rate limit message
 *
 * @param key - Rate limit configuration key
 * @returns User-friendly error message
 */
export function getRateLimitMessage(key: RateLimitKey): string {
  return RATE_LIMIT_MESSAGES[key] || "Rate limit exceeded. Please try again later.";
}

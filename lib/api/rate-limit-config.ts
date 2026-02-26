/**
 * Rate Limit Configuration
 *
 * Defines tiered rate limits for different API endpoint categories.
 * Limits are designed to prevent abuse while allowing legitimate usage.
 *
 * Architecture: docs/architecture/RATE_LIMITING_ARCHITECTURE.md
 */

import { RateLimiterConfig } from "@/types/forecast";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

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
  "image-proxy": {
    // NOTE:
    // This endpoint is hit by Next.js Image Optimization, which can legitimately
    // issue many parallel requests on a single page load (multiple images, sizes).
    // Keep SSRF protections strict (domain/IP validation), but allow enough burst
    // capacity to avoid broken images during normal browsing.
    requestsPerMinute: 60,
    requestsPerHour: 600,
    burstLimit: 25,
  } as RateLimiterConfig,

  /**
   * Recommendations - HIGH
   *
   * Endpoint: /api/v1/recommendations
   * Risk: N+1 query performance issue
   * Cost: Multiple database queries per request
   *
   * Strict limits until N+1 query is optimized
   */
  recommendations: {
    requestsPerMinute: 20,
    requestsPerHour: 200,
    burstLimit: 5,
  } as RateLimiterConfig,

  /**
   * Beach Search - HIGH
   *
   * Endpoint: /api/beaches/search
   * Risk: Expensive multi-table search operations
   * Cost: Full-text search, complex queries
   *
   * Moderate limits for expensive operations
   */
  "beach-search": {
    requestsPerMinute: 30,
    requestsPerHour: 300,
    burstLimit: 10,
  } as RateLimiterConfig,

  /**
   * Forecast Bulk - MEDIUM
   *
   * Endpoint: /api/forecasts/bulk
   * Risk: Bulk data fetching
   * Cost: Large dataset queries
   *
   * Higher limits but still controlled
   */
  "forecast-bulk": {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstLimit: 20,
  } as RateLimiterConfig,

  /**
   * Coach Picks - MEDIUM
   *
   * Endpoint: /api/coach-picks
   * Risk: Complex RPC calls
   * Cost: Database RPC function execution
   */
  "coach-picks": {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstLimit: 20,
  } as RateLimiterConfig,

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
  "public-default": {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    // Dev/test environments can issue many parallel requests (maps, image hydration, etc).
    // Keep production strict, but allow larger bursts locally to avoid breaking UX/tests.
    burstLimit: IS_PRODUCTION ? 20 : 200,
  } as RateLimiterConfig,

  /**
   * Public Showcase - optimized for marketing endpoints that need
   * higher burst tolerance (e.g., featured beaches) while still
   * enforcing rate limits after an initial warmup period.
   */
  "public-showcase": {
    requestsPerMinute: 120,
    requestsPerHour: 2000,
    burstLimit: 100,
    burstWindowMs: 60000,
    warmupDurationMs: 1500,
    rapidStreakLimit: 20,
    rapidThresholdMs: 250,
    rapidCooldownMs: 4000,
    softBurstRecovery: true,
  } as RateLimiterConfig,

  /**
   * Authenticated Default - LOW
   *
   * For endpoints requiring authentication
   * Higher limits since users are identified
   */
  "authenticated-default": {
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    burstLimit: 50,
  } as RateLimiterConfig,

  /**
   * Surf Discovery - MEDIUM
   *
   * Endpoint: /api/surf/discover
   * Risk: Complex user-specific surf spot discovery
   * Cost: Multiple database queries, scoring algorithm
   *
   * Moderate limits for personalized recommendations
   */
  "surf-discovery": {
    requestsPerMinute: IS_PRODUCTION ? 15 : 60,
    requestsPerHour: IS_PRODUCTION ? 150 : 600,
    burstLimit: IS_PRODUCTION ? 6 : 30, // Allow clicking through all 4 time slots quickly
  } as RateLimiterConfig,

  /**
   * Surf Insights - MEDIUM
   *
   * Endpoint: /api/surf/insights
   * Risk: Complex similarity scoring algorithm
   * Cost: Database queries for user sessions, similarity computation
   *
   * Moderate limits for personalized insights (same as surf-discovery)
   */
  "surf-insights": {
    requestsPerMinute: IS_PRODUCTION ? 10 : 40,
    requestsPerHour: IS_PRODUCTION ? 100 : 400,
    burstLimit: IS_PRODUCTION ? 3 : 15,
  } as RateLimiterConfig,

  /**
   * Webhook - Resend
   *
   * Endpoint: /api/webhooks/resend
   * Risk: External webhook delivery
   * Cost: Single database update per event
   *
   * Higher limits to accommodate burst webhook deliveries
   */
  "webhook-resend": {
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    burstLimit: 50,
  } as RateLimiterConfig,

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
  "hls-proxy": {
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    burstLimit: 60,
  } as RateLimiterConfig,

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
  "cam-resolve": {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    burstLimit: 10,
  } as RateLimiterConfig,
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

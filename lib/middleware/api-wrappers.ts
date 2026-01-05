/**
 * API Route Wrappers - Higher-Order Functions for Next.js API Routes
 *
 * Purpose: Eliminate duplicated boilerplate across 73+ API route files
 * - Try-catch error handling (previously 131 blocks)
 * - Authentication checks (previously duplicated 40+ times)
 * - Rate limiting and bot blocking
 * - Parameter validation
 *
 * Design Pattern: Decorator/Wrapper Pattern
 * - Composable wrappers that can be chained
 * - Each wrapper handles a single concern
 * - Business logic remains clean and focused
 *
 * @example Basic usage
 * ```ts
 * // Before (30+ lines boilerplate):
 * export async function GET(request: NextRequest) {
 *   try {
 *     const supabase = await createSupabaseServerClient();
 *     const { data: { user }, error } = await supabase.auth.getUser();
 *     if (error || !user) return createAuthError();
 *     // ... business logic
 *   } catch (error) {
 *     return handleApiError(error, "Failed to load data");
 *   }
 * }
 *
 * // After (5 lines):
 * export const GET = withAuth(async (request, { user, supabase }) => {
 *   // ... business logic only
 *   return createSuccessResponse(data);
 * }, { errorMessage: "Failed to load data" });
 * ```
 *
 * @see docs/API_MIDDLEWARE.md for patterns and usage
 * @see docs/API_MIDDLEWARE_REFERENCE.md for technical details
 */

import { NextRequest, NextResponse } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  handleApiError,
  createAuthError,
  createValidationError,
  isValidUuid,
  DEFAULT_SECURITY_HEADERS,
} from "@/lib/api-utils";
import type { Database } from "@/types/supabase";
import { withBotBlocking } from "@/lib/middleware/bot-blocker";
import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import {
  RATE_LIMITS,
  type RateLimitKey,
  getRateLimitMessage,
} from "@/lib/api/rate-limit-config";
import { logRateLimitViolation } from "@/lib/monitoring/rate-limit-telemetry";

// Re-export bot blocking and rate limit types for convenience
export { withBotBlocking } from "@/lib/middleware/bot-blocker";
export type { RateLimitKey } from "@/lib/api/rate-limit-config";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Standard Next.js route handler signature
 */
export type RouteHandler = (
  request: NextRequest,
  context?: RouteContext
) => Promise<NextResponse>;

/**
 * Route context with typed params
 */
export interface RouteContext {
  params: Record<string, string>;
}

/**
 * Extended context provided to authenticated handlers
 */
export interface AuthenticatedContext extends RouteContext {
  user: User;
  supabase: SupabaseClient<Database>;
}

/**
 * Handler that receives authenticated context
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthenticatedContext
) => Promise<NextResponse>;

/**
 * Handler that receives optional auth (user may be null)
 */
export type OptionalAuthHandler = (
  request: NextRequest,
  context: RouteContext & {
    user: User | null;
    supabase: SupabaseClient<Database>;
  }
) => Promise<NextResponse>;

/**
 * Options for withAuth wrapper
 */
export interface WithAuthOptions {
  /** Custom error message for failed authentication */
  authErrorMessage?: string;
  /** Custom error message for caught exceptions */
  errorMessage?: string;
  /** Allow unauthenticated access (user will be null) */
  optional?: boolean;
}

/**
 * Options for withErrorHandler wrapper
 */
export interface WithErrorHandlerOptions {
  /** Custom error message for caught exceptions */
  errorMessage?: string;
  /** Include original error details in response (dev only) */
  includeDetails?: boolean;
}

/**
 * Options for createApiHandler
 */
export interface CreateApiHandlerOptions {
  /** Require authentication (default: true) */
  auth?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Allow unauthenticated access with optional user */
  optionalAuth?: boolean;
}

/**
 * Options for withRateLimit wrapper
 */
export interface WithRateLimitOptions {
  /** Rate limit key from rate-limit-config.ts */
  key?: RateLimitKey;
  /**
   * Auth-aware rate limiting (adaptive keys).
   *
   * NOTE: This requires checking auth status (Supabase `getUser()`) to choose
   * the correct key, which adds overhead and partially defeats the “rate limit
   * before auth” latency optimization. Use sparingly.
   */
  authAware?: {
    publicLimitKey: RateLimitKey;
    authenticatedLimitKey: RateLimitKey;
  };
}

/**
 * Options for withBotBlocking wrapper
 */
export interface WithBotBlockingOptions {
  /** Custom error message for blocked bots */
  errorMessage?: string;
}

/**
 * Options for withProtection unified wrapper
 */
export interface ProtectionOptions {
  /** Authentication configuration */
  auth?: {
    /** Require authentication (default: false if omitted) */
    required: boolean;
    /** Custom error message for failed authentication */
    errorMessage?: string;
  };

  /** Rate limiting configuration */
  rateLimit?: WithRateLimitOptions;

  /** Bot blocking configuration */
  botBlocking?: {
    /** Enable bot blocking (default: false) */
    enabled: boolean;
    /** Custom error message */
    errorMessage?: string;
  };

  /** Error handling configuration */
  errorHandling?: WithErrorHandlerOptions;
}

// =============================================================================
// CORE WRAPPERS
// =============================================================================

/**
 * Wraps a route handler with try-catch error handling.
 *
 * Catches all exceptions and returns a standardized error response
 * using handleApiError from api-utils.
 *
 * @param handler - The route handler to wrap
 * @param options - Configuration options
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```ts
 * export const GET = withErrorHandler(
 *   async (request) => {
 *     const data = await fetchData();
 *     return createSuccessResponse(data);
 *   },
 *   { errorMessage: "Failed to fetch data" }
 * );
 * ```
 */
export function withErrorHandler(
  handler: RouteHandler,
  options: WithErrorHandlerOptions = {}
): RouteHandler {
  const { errorMessage, includeDetails = false } = options;

  return async (request: NextRequest, context?: RouteContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error, errorMessage, includeDetails);
    }
  };
}

/**
 * Wraps a route handler with authentication.
 *
 * - Creates Supabase client
 * - Validates user authentication
 * - Injects user and supabase into handler context
 * - Returns 401 if not authenticated (unless optional: true)
 * - Includes error handling (no need to wrap with withErrorHandler)
 *
 * @param handler - Handler receiving AuthenticatedContext
 * @param options - Configuration options
 * @returns Wrapped handler with auth and error handling
 *
 * @example Required auth
 * ```ts
 * export const GET = withAuth(async (request, { user, supabase }) => {
 *   const { data } = await supabase
 *     .from("boards")
 *     .select("*")
 *     .eq("user_id", user.id);
 *   return createSuccessResponse({ boards: data });
 * });
 * ```
 *
 * @example Optional auth
 * ```ts
 * export const GET = withAuth(
 *   async (request, { user, supabase }) => {
 *     // user may be null
 *     const isOwner = user?.id === resourceOwnerId;
 *     return createSuccessResponse({ data, isOwner });
 *   },
 *   { optional: true }
 * );
 * ```
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options?: Omit<WithAuthOptions, "optional"> & { optional?: false }
): RouteHandler;
export function withAuth(
  handler: OptionalAuthHandler,
  options: Omit<WithAuthOptions, "optional"> & { optional: true }
): RouteHandler;
// Backward-compatible overload: allow boolean `optional` when the handler may be either.
// This supports wrapper composition (e.g., `withProtection`) without forcing call-site casts.
export function withAuth(
  handler: AuthenticatedHandler | OptionalAuthHandler,
  options?: WithAuthOptions
): RouteHandler;
export function withAuth(
  handler: AuthenticatedHandler | OptionalAuthHandler,
  options: WithAuthOptions = {}
): RouteHandler {
  const {
    authErrorMessage = "Authentication required",
    errorMessage,
    optional = false,
  } = options;

  return async (request: NextRequest, context?: RouteContext) => {
    try {
      const supabase = await createSupabaseServerClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // Required auth
      if (!optional) {
        if (userError || !user) {
          return createAuthError(authErrorMessage);
        }

        const authContext: AuthenticatedContext = {
          params: context?.params ?? {},
          user,
          supabase,
        };

        return await (handler as AuthenticatedHandler)(request, authContext);
      }

      // Optional auth
      const optionalContext: RouteContext & {
        user: User | null;
        supabase: SupabaseClient<Database>;
      } = {
        params: context?.params ?? {},
        user: userError ? null : user,
        supabase,
      };

      return await (handler as OptionalAuthHandler)(request, optionalContext);
    } catch (error) {
      return handleApiError(error, errorMessage);
    }
  };
}

/**
 * Creates an API handler with configurable auth and error handling.
 *
 * This is the recommended way to create route handlers as it provides
 * a clean, composable interface for common patterns.
 *
 * @param handler - The business logic handler
 * @param options - Configuration options
 * @returns Configured route handler
 *
 * @example Basic authenticated route
 * ```ts
 * export const GET = createApiHandler(
 *   async (request, { user, supabase, params }) => {
 *     const { data } = await supabase.from("items").select("*");
 *     return createSuccessResponse({ items: data });
 *   },
 *   { auth: true, errorMessage: "Failed to load items" }
 * );
 * ```
 *
 * @example Public route with optional auth
 * ```ts
 * export const GET = createApiHandler(
 *   async (request, { user, supabase }) => {
 *     // user may be null for public access
 *     return createSuccessResponse({ isLoggedIn: !!user });
 *   },
 *   { optionalAuth: true }
 * );
 * ```
 */
export function createApiHandler(
  handler: AuthenticatedHandler | OptionalAuthHandler,
  options: CreateApiHandlerOptions = {}
): RouteHandler {
  const { auth = true, errorMessage, optionalAuth = false } = options;

  if (auth || optionalAuth) {
    return withAuth(handler, {
      optional: optionalAuth,
      errorMessage,
    });
  }

  // No auth required - just wrap with error handling
  return withErrorHandler(
    async (request, context) => {
      const supabase = await createSupabaseServerClient();
      return await (handler as OptionalAuthHandler)(request, {
        params: context?.params ?? {},
        user: null,
        supabase,
      });
    },
    { errorMessage }
  );
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates a UUID parameter from route context.
 *
 * Returns a validation error response if invalid, or the validated UUID.
 *
 * @param paramValue - The parameter value to validate
 * @param paramName - Name of the parameter (for error message)
 * @returns Object with either valid UUID or error response
 *
 * @example
 * ```ts
 * export const GET = withAuth(async (request, { params, user, supabase }) => {
 *   const uuidResult = validateUuidParam(params.id, "session");
 *   if ("error" in uuidResult) return uuidResult.error;
 *
 *   const sessionId = uuidResult.value;
 *   // ... use sessionId
 * });
 * ```
 */
export function validateUuidParam(
  paramValue: string | undefined,
  paramName: string = "id"
): { value: string } | { error: NextResponse } {
  if (!paramValue || !isValidUuid(paramValue)) {
    return {
      error: createValidationError(`Invalid ${paramName} format`),
    };
  }
  return { value: paramValue };
}

/**
 * Validates multiple required parameters exist.
 *
 * @param params - Object containing parameters
 * @param required - Array of required parameter names
 * @returns Validation error or null if valid
 *
 * @example
 * ```ts
 * const searchParams = request.nextUrl.searchParams;
 * const params = {
 *   lat: searchParams.get("lat"),
 *   lon: searchParams.get("lon"),
 * };
 *
 * const error = validateRequiredParams(params, ["lat", "lon"]);
 * if (error) return error;
 * ```
 */
export function validateRequiredParams(
  params: Record<string, string | null | undefined>,
  required: string[]
): NextResponse | null {
  const missing = required.filter((key) => !params[key]);

  if (missing.length > 0) {
    return createValidationError(`Missing required parameters: ${missing.join(", ")}`, {
      required,
      missing,
    });
  }

  return null;
}

// =============================================================================
// OWNERSHIP HELPERS
// =============================================================================

/**
 * Result of ownership check
 */
export type OwnershipResult =
  | { ok: true }
  | { error: NextResponse };

/**
 * Checks if a user owns a resource by querying the database.
 *
 * Returns a 404 if resource not found, 403 if not owned by user.
 *
 * @param supabase - Supabase client
 * @param table - Table name to query
 * @param resourceId - ID of the resource
 * @param userId - ID of the user who should own it
 * @param resourceName - Human-readable name for error messages
 * @returns Ownership result
 *
 * @example
 * ```ts
 * export const DELETE = withAuth(async (request, { params, user, supabase }) => {
 *   const ownership = await requireOwnership(
 *     supabase,
 *     "sessions",
 *     params.id,
 *     user.id,
 *     "Session"
 *   );
 *   if ("error" in ownership) return ownership.error;
 *
 *   // Proceed with deletion
 * });
 * ```
 */
export async function requireOwnership(
  supabase: SupabaseClient<Database>,
  table: keyof Database["public"]["Tables"],
  resourceId: string,
  userId: string,
  resourceName: string = "Resource"
): Promise<OwnershipResult> {
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id, user_id")
    .eq("id", resourceId)
    .single();

  if (existingError) {
    if (existingError.code === "PGRST116") {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: `${resourceName} not found`,
            timestamp: new Date().toISOString(),
          },
          { status: 404, headers: DEFAULT_SECURITY_HEADERS }
        ),
      };
    }
    throw existingError;
  }

  if (!existing || (existing as any).user_id !== userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          timestamp: new Date().toISOString(),
        },
        { status: 403, headers: DEFAULT_SECURITY_HEADERS }
      ),
    };
  }

  return { ok: true };
}

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

// Re-export commonly used utilities so routes only need one import
export {
  createSuccessResponse,
  createErrorResponse,
  createValidationError,
  createAuthError,
  createNotFoundError,
  handleApiError,
  methodNotAllowed,
  isValidUuid,
  validateOrError,
  createCachedResponse,
  checkNotModified,
  CacheDuration,
} from "@/lib/api-utils";

// =============================================================================
// RATE LIMITING WRAPPERS
// =============================================================================

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
  // `x-vercel-forwarded-for` is set by Vercel’s edge and is harder to spoof than
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

// =============================================================================
// COMBINED PROTECTION WRAPPERS
// =============================================================================

/**
 * Combined auth + rate limiting wrapper
 *
 * Pre-composed wrapper for authenticated endpoints with rate limits.
 *
 * @param handler - Handler receiving AuthenticatedContext
 * @param options - Auth and rate limit configuration
 * @returns Wrapped handler
 *
 * @example Required auth with rate limiting
 * ```ts
 * export const POST = withAuthAndRateLimit(
 *   async (req, { user, supabase }) => {
 *     return createSuccessResponse({ userId: user.id });
 *   },
 *   {
 *     auth: { required: true },
 *     rateLimit: { key: 'authenticated-default' }
 *   }
 * );
 * ```
 */
export function withAuthAndRateLimit(
  handler: AuthenticatedHandler | OptionalAuthHandler,
  options: {
    auth: { required: boolean; errorMessage?: string };
    rateLimit: WithRateLimitOptions;
    errorMessage?: string;
  }
): RouteHandler {
  const authHandler = withAuth(handler, {
    optional: !options.auth.required,
    authErrorMessage: options.auth.errorMessage,
    errorMessage: options.errorMessage,
  });

  return withRateLimit(authHandler, options.rateLimit);
}

/**
 * Full protection suite wrapper
 *
 * Bot blocking + rate limiting + authentication + error handling.
 * All protections applied in optimal order.
 *
 * @param handler - Handler receiving AuthenticatedContext
 * @param options - Full protection configuration
 * @returns Wrapped handler
 *
 * @example
 * ```ts
 * export const POST = withFullProtection(
 *   async (req, { user, supabase }) => {
 *     return createSuccessResponse({ data });
 *   },
 *   {
 *     auth: { required: true },
 *     rateLimit: { key: 'authenticated-default' },
 *     botBlocking: { enabled: true }
 *   }
 * );
 * ```
 */
export function withFullProtection(
  handler: AuthenticatedHandler | OptionalAuthHandler,
  options: ProtectionOptions
): RouteHandler {
  let wrappedHandler: RouteHandler = withAuth(handler, {
    optional: options.auth ? !options.auth.required : true,
    authErrorMessage: options.auth?.errorMessage,
    errorMessage: options.errorHandling?.errorMessage,
  });

  if (options.rateLimit) {
    wrappedHandler = withRateLimit(wrappedHandler, options.rateLimit);
  }

  if (options.botBlocking?.enabled) {
    wrappedHandler = withBotBlocking(wrappedHandler);
  }

  return wrappedHandler;
}

/**
 * Unified protection wrapper with declarative configuration
 *
 * Automatically composes middleware layers based on options.
 * Replaces manual wrapper composition for most use cases.
 *
 * Protection order (outer → inner):
 * 1. Bot blocking (fastest rejection)
 * 2. Rate limiting (state lookup)
 * 3. Authentication (Supabase check)
 * 4. Error handling (catch-all)
 *
 * @param handler - Route handler (may receive AuthenticatedContext if auth enabled)
 * @param options - Protection configuration
 * @returns Wrapped handler
 *
 * @example Public endpoint with bot blocking and rate limiting
 * ```ts
 * export const GET = withProtection(handler, {
 *   rateLimit: { key: 'public-default' },
 *   botBlocking: { enabled: true }
 * });
 * ```
 *
 * @example Authenticated endpoint with rate limiting
 * ```ts
 * export const POST = withProtection(
 *   async (req, { user, supabase }) => {
 *     return createSuccessResponse({ userId: user.id });
 *   },
 *   {
 *     auth: { required: true },
 *     rateLimit: { key: 'authenticated-default' }
 *   }
 * );
 * ```
 *
 * @example Public endpoint with rate limiting only (no bot blocking)
 * ```ts
 * export const GET = withProtection(handler, {
 *   rateLimit: { key: 'public-default' }
 * });
 * ```
 */
export function withProtection(
  handler: RouteHandler | AuthenticatedHandler | OptionalAuthHandler,
  options: ProtectionOptions = {}
): RouteHandler {
  // Apply layers in reverse order (innermost first)
  let wrappedHandler: RouteHandler;

  // If auth is configured, wrap with withAuth
  if (options.auth) {
    wrappedHandler = withAuth(handler as AuthenticatedHandler | OptionalAuthHandler, {
      optional: !options.auth.required,
      authErrorMessage: options.auth.errorMessage,
      errorMessage: options.errorHandling?.errorMessage,
    });
  } else {
    // No auth - wrap with error handler only if configured
    wrappedHandler = options.errorHandling
      ? withErrorHandler(handler as RouteHandler, options.errorHandling)
      : (handler as RouteHandler);
  }

  // Apply rate limiting if configured
  if (options.rateLimit) {
    wrappedHandler = withRateLimit(wrappedHandler, options.rateLimit);
  }

  // Apply bot blocking if enabled (outermost layer)
  if (options.botBlocking?.enabled) {
    wrappedHandler = withBotBlocking(wrappedHandler);
  }

  return wrappedHandler;
}

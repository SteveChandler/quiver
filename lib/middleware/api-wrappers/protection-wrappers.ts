/**
 * Protection Wrappers
 *
 * Combined protection wrappers that compose multiple middleware layers.
 * Protection order (outer -> inner): bot -> rate limit -> auth (fastest rejection first)
 */

import { withBotBlocking } from "@/lib/middleware/bot-blocker";
import type {
  RouteHandler,
  AuthenticatedHandler,
  OptionalAuthHandler,
  ProtectionOptions,
  WithRateLimitOptions,
} from "./types";
import { withAuth } from "./auth-wrapper";
import { withErrorHandler } from "./error-handler";
import { withRateLimit } from "./rate-limit-wrapper";

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
 * Protection order (outer -> inner):
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

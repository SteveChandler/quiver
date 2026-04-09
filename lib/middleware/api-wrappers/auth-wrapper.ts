/**
 * Authentication Wrapper
 *
 * Provides authentication handling for API route handlers.
 * Supports both required and optional authentication patterns.
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBearerTokenClient } from "@/lib/supabase/bearer-client";
import { handleApiError, createAuthError } from "@/lib/api-utils";
import type {
  RouteHandler,
  RouteContext,
  AuthenticatedContext,
  AuthenticatedHandler,
  OptionalAuthHandler,
  OptionalAuthContext,
  WithAuthOptions,
  CreateApiHandlerOptions,
} from "./types";
import { withErrorHandler } from "./error-handler";

/**
 * Extracts a Bearer token from the Authorization header.
 * Returns null when the header is missing or not a Bearer scheme.
 * Requires a non-whitespace token — `Bearer    ` alone is rejected.
 *
 * Uses optional chaining on `request.headers` because some existing route
 * tests stub the request as `{}` and rely on mocked auth — the Bearer path
 * must degrade to "no token" rather than throwing on such shapes.
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers?.get("authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

/**
 * Resolves the authenticated user and a correctly-scoped Supabase client from
 * either an `Authorization: Bearer <jwt>` header (mobile/native clients) or
 * the SSR cookie session (web clients). Bearer takes precedence when present.
 *
 * The returned Supabase client is always scoped to the authenticated user so
 * RLS policies enforce `auth.uid()` correctly regardless of the auth path.
 *
 * Why the try/catch: `supabase.auth.getUser()` normally returns an AuthError
 * inside `{ error }` on auth failures, but can throw on transport failures
 * (DNS / TLS / fetch). Without catching, those bubble to `handleApiError` and
 * return 500. An auth resolution failure should always translate to a 401.
 */
async function resolveAuth(request: NextRequest): Promise<{
  supabase: SupabaseClient<Database>;
  user: User | null;
  error: Error | null;
}> {
  const bearerToken = extractBearerToken(request);

  if (bearerToken) {
    // Native/mobile client — validate the user JWT against Supabase auth
    // and return a client that injects the Bearer on all downstream queries.
    const supabase = createBearerTokenClient(bearerToken);
    try {
      const { data, error } = await supabase.auth.getUser(bearerToken);
      return { supabase, user: data.user, error };
    } catch (err) {
      return { supabase, user: null, error: err as Error };
    }
  }

  // Web client — cookie-based SSR auth (unchanged legacy path).
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    return { supabase, user: data.user, error };
  } catch (err) {
    return { supabase, user: null, error: err as Error };
  }
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
      // Resolve auth from Bearer header (native) or SSR cookies (web).
      // The returned `supabase` client is already scoped to the authenticated
      // user so downstream queries enforce RLS against auth.uid() correctly.
      const { supabase, user, error: userError } = await resolveAuth(request);

      // In Next.js 15+, params is a Promise that must be awaited
      const resolvedParams = context?.params
        ? typeof context.params === "object" && "then" in context.params
          ? await context.params
          : (context.params as Record<string, string>)
        : {};

      // Required auth
      if (!optional) {
        if (userError || !user) {
          return createAuthError(authErrorMessage);
        }

        const authContext: AuthenticatedContext = {
          params: resolvedParams,
          user,
          supabase,
        };

        return await (handler as AuthenticatedHandler)(request, authContext);
      }

      // Optional auth
      const optionalContext: OptionalAuthContext = {
        params: resolvedParams,
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

      // In Next.js 15+, params is a Promise that must be awaited
      const resolvedParams = context?.params
        ? typeof context.params === "object" && "then" in context.params
          ? await context.params
          : (context.params as Record<string, string>)
        : {};

      return await (handler as OptionalAuthHandler)(request, {
        params: resolvedParams,
        user: null,
        supabase,
      });
    },
    { errorMessage }
  );
}

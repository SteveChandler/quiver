/**
 * Authentication Wrapper
 *
 * Provides authentication handling for API route handlers.
 * Supports both required and optional authentication patterns.
 */

import type { NextRequest } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, createAuthError } from "@/lib/api-utils";
import type { Database } from "@/types/supabase";
import type {
  RouteHandler,
  RouteContext,
  AuthenticatedContext,
  AuthenticatedHandler,
  OptionalAuthHandler,
  WithAuthOptions,
  CreateApiHandlerOptions,
} from "./types";
import { withErrorHandler } from "./error-handler";

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

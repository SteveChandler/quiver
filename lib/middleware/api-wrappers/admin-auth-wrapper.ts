/**
 * Admin Authentication Wrappers
 *
 * Provides admin-level authentication handling for API route handlers.
 * - withAdminAuth: Requires admin session (via authenticateAdmin())
 * - withBearerAuth: Accepts Bearer service-role key OR admin session
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-utils";
import type {
  RouteHandler,
  RouteContext,
  AdminAuthenticatedContext,
  AdminAuthenticatedHandler,
  BearerAuthContext,
  BearerAuthHandler,
  WithAdminAuthOptions,
} from "./types";

/**
 * Wraps a route handler with admin authentication.
 *
 * - Calls authenticateAdmin() to verify admin session
 * - Creates a service-role Supabase client for privileged operations
 * - Injects user and supabase into handler context
 * - Returns 401/403 if not authenticated or not admin
 * - Includes error handling (no need to wrap with withErrorHandler)
 *
 * @param handler - Handler receiving AdminAuthenticatedContext
 * @param options - Configuration options
 * @returns Wrapped handler with admin auth and error handling
 *
 * @example
 * ```ts
 * export const GET = withAdminAuth(async (request, { user, supabase }) => {
 *   const { data } = await supabase.from("admin_table").select("*");
 *   return createSuccessResponse(data);
 * }, { errorMessage: "Failed to load admin data" });
 * ```
 */
export function withAdminAuth(
  handler: AdminAuthenticatedHandler,
  options: WithAdminAuthOptions = {}
): RouteHandler {
  const { errorMessage } = options;

  return async (request: NextRequest, context?: RouteContext) => {
    try {
      const authResult = await authenticateAdmin();
      if (!authResult.success) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status }
        );
      }

      const supabase = await createSupabaseServiceRoleClient();

      // In Next.js 15+, params is a Promise that must be awaited
      const resolvedParams = context?.params
        ? typeof context.params === "object" && "then" in context.params
          ? await context.params
          : (context.params as Record<string, string>)
        : {};

      const adminContext: AdminAuthenticatedContext = {
        params: resolvedParams,
        user: authResult.user,
        supabase,
      };

      return await handler(request, adminContext);
    } catch (error) {
      return handleApiError(error, errorMessage);
    }
  };
}

/**
 * Wraps a route handler with bearer token OR admin session authentication.
 *
 * Checks in order:
 * 1. Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> header
 * 2. Falls back to authenticateAdmin() session check
 *
 * This supports both script/automation callers (service role key)
 * and web admin users (cookie-based session).
 *
 * @param handler - Handler receiving AdminAuthenticatedContext (user is null for bearer auth)
 * @param options - Configuration options
 * @returns Wrapped handler with dual auth and error handling
 *
 * @example
 * ```ts
 * export const POST = withBearerAuth(async (request, { supabase }) => {
 *   // Called via script with service role key or by admin user
 *   const { data } = await supabase.from("table").select("*");
 *   return createSuccessResponse(data);
 * }, { errorMessage: "Failed to sync" });
 * ```
 */
export function withBearerAuth(
  handler: BearerAuthHandler,
  options: WithAdminAuthOptions = {}
): RouteHandler {
  const { errorMessage } = options;

  return async (request: NextRequest, context?: RouteContext) => {
    try {
      const supabase = await createSupabaseServiceRoleClient();

      // In Next.js 15+, params is a Promise that must be awaited
      const resolvedParams = context?.params
        ? typeof context.params === "object" && "then" in context.params
          ? await context.params
          : (context.params as Record<string, string>)
        : {};

      // Check for service role bearer token
      const authHeader = request.headers.get("authorization");
      const isServiceRole =
        authHeader?.startsWith("Bearer ") &&
        authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

      if (isServiceRole) {
        const bearerContext: BearerAuthContext = {
          params: resolvedParams,
          user: null,
          supabase,
          authMethod: "bearer",
        };
        return await handler(request, bearerContext);
      }

      // Fall back to admin session authentication
      const authResult = await authenticateAdmin();
      if (!authResult.success) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status }
        );
      }

      const adminContext: BearerAuthContext = {
        params: resolvedParams,
        user: authResult.user,
        supabase,
        authMethod: "admin",
      };

      return await handler(request, adminContext);
    } catch (error) {
      return handleApiError(error, errorMessage);
    }
  };
}


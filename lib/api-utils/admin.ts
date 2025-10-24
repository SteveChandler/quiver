/**
 * Admin API Route Utilities
 *
 * Provides wrappers and guards for API routes that require admin privileges.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdmin } from "@/lib/auth/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  handleApiError,
  createSuccessResponse,
  type ApiError,
  DEFAULT_SECURITY_HEADERS,
} from "@/lib/api-utils";

/**
 * Create an unauthorized error response
 */
export function createUnauthorizedResponse(
  message: string = "Authentication required"
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    {
      status: 401,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

/**
 * Create a forbidden error response
 */
export function createForbiddenResponse(
  message: string = "Admin access required"
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    {
      status: 403,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

/**
 * Wrap an API route handler with admin authentication
 *
 * Usage:
 * ```typescript
 * export const POST = withAdminRoute(async (request, { supabaseAdmin }) => {
 *   const body = await request.json();
 *   const result = await supabaseAdmin.from('beaches').insert(body);
 *   return createSuccessResponse(result.data);
 * });
 * ```
 */
export function withAdminRoute<T = any>(
  handler: (
    request: NextRequest,
    context: { supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient> }
  ) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Authenticate admin user
      const authResult = await authenticateAdmin();

      if (!authResult.success) {
        // Return appropriate error response
        if (authResult.status === 401) {
          return createUnauthorizedResponse(authResult.error);
        }
        return createForbiddenResponse(authResult.error);
      }

      // Create service role client for admin operations
      const supabaseAdmin = createSupabaseServiceRoleClient();

      // Execute the handler
      return await handler(request, { supabaseAdmin });
    } catch (error) {
      return handleApiError(error, "Admin API route error");
    }
  };
}

/**
 * Alternative wrapper that provides both user and service role client
 *
 * Usage:
 * ```typescript
 * export const POST = withAdminRouteAndUser(async (request, { user, supabaseAdmin }) => {
 *   // Log who made the request
 *   console.log(`Admin ${user.email} performed action`);
 *
 *   const body = await request.json();
 *   const result = await supabaseAdmin.from('beaches').insert(body);
 *   return createSuccessResponse(result.data);
 * });
 * ```
 */
export function withAdminRouteAndUser<T = any>(
  handler: (
    request: NextRequest,
    context: {
      user: NonNullable<Awaited<ReturnType<typeof authenticateAdmin>>["user"]>;
      supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>;
    }
  ) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Authenticate admin user
      const authResult = await authenticateAdmin();

      if (!authResult.success) {
        // Return appropriate error response
        if (authResult.status === 401) {
          return createUnauthorizedResponse(authResult.error);
        }
        return createForbiddenResponse(authResult.error);
      }

      // Create service role client for admin operations
      const supabaseAdmin = createSupabaseServiceRoleClient();

      // Execute the handler with user and admin client
      return await handler(request, { user: authResult.user, supabaseAdmin });
    } catch (error) {
      return handleApiError(error, "Admin API route error");
    }
  };
}

/**
 * Check if a request is from an admin user
 * Useful for conditional logic in routes that aren't admin-only
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const result = await authenticateAdmin();
    return result.success;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

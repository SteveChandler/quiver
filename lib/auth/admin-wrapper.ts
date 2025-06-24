import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAdmin,
  requireAdmin,
  isAdmin,
  getCurrentUser,
} from "./admin";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

/**
 * Enhanced admin auth wrapper for API routes
 * Centralizes admin authentication checks
 *
 * Usage:
 * export async function POST(request: NextRequest) {
 *   return withAdminAuth(async (user) => {
 *     // user is guaranteed to be an admin here
 *     // ... your admin API logic
 *     return NextResponse.json({ success: true });
 *   });
 * }
 */
export async function withAdminAuth<T>(
  handler: (user: any) => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  try {
    const authResult = await authenticateAdmin();

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    return await handler(authResult.user);
  } catch (error) {
    console.error("Admin auth wrapper error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Enhanced admin auth wrapper for server actions
 *
 * Usage:
 * export const adminAction = withAdminServerAction(async (user, ...args) => {
 *   // user is guaranteed to be an admin here
 *   return { success: true, data: result };
 * });
 */
export async function withAdminServerAction<T extends any[], R>(
  action: (user: any, ...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const result = await requireAdmin();

    if (result.error) {
      throw new Error(result.error);
    }

    return action(result.user, ...args);
  };
}

/**
 * Check admin status for client components
 * Returns admin status and user info
 *
 * Usage:
 * const { isUserAdmin, user, loading, error } = useAdminCheck();
 */
export async function checkAdminStatus() {
  try {
    const supabase = createAPIServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        isUserAdmin: false,
        user: null,
        error: "Not authenticated",
      };
    }

    return {
      isUserAdmin: isAdmin(user as any),
      user,
      error: null,
    };
  } catch (error) {
    return {
      isUserAdmin: false,
      user: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Admin route guard middleware
 * Use this to protect admin-only pages
 *
 * Usage in middleware.ts:
 * if (pathname.startsWith('/admin')) {
 *   const adminCheck = await adminRouteGuard(request);
 *   if (adminCheck) return adminCheck;
 * }
 */
export async function adminRouteGuard(
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    const authResult = await authenticateAdmin();

    if (!authResult.success) {
      // Redirect to sign-in with admin access required message
      const signInUrl = new URL("/auth/sign-in", request.url);
      signInUrl.searchParams.set("message", "Admin access required");
      signInUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    // User is admin, allow access
    return null;
  } catch (error) {
    console.error("Admin route guard error:", error);
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("message", "Authentication error");
    return NextResponse.redirect(signInUrl);
  }
}

/**
 * Simplified admin check for API routes that need flexible auth
 * Returns boolean instead of throwing errors
 *
 * Usage:
 * export async function GET(request: NextRequest) {
 *   const isUserAdmin = await isAdminRequest();
 *
 *   if (isUserAdmin) {
 *     // Show admin-only data
 *   } else {
 *     // Show public data
 *   }
 * }
 */
export async function isAdminRequest(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user ? isAdmin(user) : false;
  } catch (error) {
    return false;
  }
}

/**
 * Admin auth types for TypeScript support
 */
export interface AdminAuthResult {
  success: boolean;
  user?: any;
  error?: string;
  status?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  user_metadata?: {
    role?: string;
    is_admin?: boolean;
  };
  app_metadata?: {
    role?: string;
    is_admin?: boolean;
  };
}

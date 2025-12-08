import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors/admin-errors";

// Canonical admin user IDs - keep in sync with database seed
// This provides a failsafe in case metadata isn't populated yet
export const ADMIN_USER_IDS = [
  "bcdc5d59-2e22-4006-98a6-cada8618577a", // Canonical admin user
] as const;

// Matches Ruby AdminAuthenticationManagement functionality
export interface AdminUser extends Omit<User, 'app_metadata' | 'user_metadata'> {
  user_metadata?: {
    role?: string;
    is_admin?: boolean;
  };
  app_metadata?: {
    role?: string;
    is_admin?: boolean;
  };
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return (session?.user as AdminUser) || null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

export function isAdmin(user: AdminUser | null): boolean {
  if (!user) return false;

  // Check canonical admin user IDs first (failsafe)
  if (ADMIN_USER_IDS.includes(user.id as any)) {
    return true;
  }

  // Check various sources for admin role
  return (
    user.user_metadata?.is_admin === true ||
    user.app_metadata?.is_admin === true ||
    user.user_metadata?.role === "admin" ||
    user.app_metadata?.role === "admin"
  );
}

export async function requireAdmin(): Promise<
  { user: AdminUser; error?: never } | { user?: never; error: string }
> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  if (!isAdmin(user)) {
    return { error: "Admin access required" };
  }

  return { user };
}

// Helper function for API routes to check admin status
export async function authenticateAdmin(): Promise<
  | { success: true; user: AdminUser }
  | { success: false; error: string; status: number }
> {
  const result = await requireAdmin();

  if ("error" in result) {
    return {
      success: false,
      error: result.error,
      status: result.error === "Authentication required" ? 401 : 403,
    };
  }

  return {
    success: true,
    user: result.user,
  };
}

/**
 * Require admin access or throw an error
 * Use this in server actions where you want exceptions instead of result objects
 */
export async function requireAdminOrThrow(): Promise<AdminUser> {
  const result = await requireAdmin();

  if ("error" in result) {
    if (result.error === "Authentication required") {
      throw new UnauthorizedError(result.error);
    }
    throw new ForbiddenError(result.error);
  }

  return result.user;
}

/**
 * TypeScript assertion function to narrow user type to AdminUser
 * Throws if user is null or not an admin
 */
export function assertIsAdmin(user: AdminUser | null): asserts user is AdminUser {
  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!isAdmin(user)) {
    throw new ForbiddenError("Admin access required");
  }
}

/**
 * Check if the current user is an admin from cookie/session
 * Useful for middleware checks without database queries
 */
export async function isAdminFromCookie(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return isAdmin(user);
  } catch (error) {
    console.error("Error checking admin from cookie:", error);
    return false;
  }
}

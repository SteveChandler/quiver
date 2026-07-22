import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors/admin-errors";

// Canonical admin user IDs - keep in sync with database seed
// This provides a failsafe in case metadata isn't populated yet
export const ADMIN_USER_IDS = [
  "bcdc5d59-2e22-4006-98a6-cada8618577a", // Canonical admin user
] as const;

// Matches Ruby AdminAuthenticationManagement functionality
export interface AdminUser extends Omit<
  User,
  "app_metadata" | "user_metadata"
> {
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
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    return user as AdminUser;
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

  // Only app metadata is server-controlled; user metadata is user-editable.
  return (
    user.app_metadata?.is_admin === true || user.app_metadata?.role === "admin"
  );
}

async function requireAdmin(): Promise<
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
      error: result.error ?? "Unknown error",
      status: result.error === "Authentication required" ? 401 : 403,
    };
  }

  return {
    success: true,
    user: result.user,
  };
}

/**
 * TypeScript assertion function to narrow user type to AdminUser
 * Throws if user is null or not an admin
 */
export function assertIsAdmin(
  user: AdminUser | null,
): asserts user is AdminUser {
  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!isAdmin(user)) {
    throw new ForbiddenError("Admin access required");
  }
}

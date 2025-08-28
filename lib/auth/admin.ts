import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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
export async function authenticateAdmin() {
  const result = await requireAdmin();

  if (result.error) {
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

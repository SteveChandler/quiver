/**
 * AdminChecker - Handles admin privilege validation for middleware
 *
 * Responsibilities:
 * - Check if user has admin privileges
 * - Integrate with canonical admin user IDs
 * - Support metadata-based admin checks (future enhancement)
 *
 * Design Pattern: Strategy Pattern
 * - Encapsulates admin authorization logic
 * - Separates admin checking from general authentication
 * - Provides flexible admin validation strategies
 */

import type { User } from "@supabase/supabase-js";
import { ADMIN_USER_IDS } from "@/lib/auth/admin";

export interface AdminCheckResult {
  isAdmin: boolean;
  userId: string;
  reason?: string;
}

export class AdminChecker {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Check if user has admin privileges
   *
   * Uses a multi-source validation approach:
   * 1. Canonical admin user IDs (failsafe, always checked first)
   * 2. User metadata admin flags (future enhancement)
   * 3. App metadata admin flags (future enhancement)
   *
   * @param user - The authenticated user to check
   * @returns AdminCheckResult with admin status and reason
   */
  checkAdminStatus(user: User): AdminCheckResult {
    // Check canonical admin user IDs first (primary source of truth)
    if (this.isCanonicalAdmin(user.id)) {
      this.log(`User ${user.id} is canonical admin`);
      return {
        isAdmin: true,
        userId: user.id,
        reason: "Canonical admin user ID",
      };
    }

    // Check user metadata for admin flag
    if (this.hasAdminMetadata(user)) {
      this.log(`User ${user.id} has admin metadata`);
      return {
        isAdmin: true,
        userId: user.id,
        reason: "Admin metadata flag",
      };
    }

    // User is not an admin
    this.log(`User ${user.id} is not an admin`);
    return {
      isAdmin: false,
      userId: user.id,
      reason: "No admin privileges found",
    };
  }

  /**
   * Check if user ID matches canonical admin list
   * This is the primary and most reliable check
   */
  private isCanonicalAdmin(userId: string): boolean {
    return ADMIN_USER_IDS.includes(userId as any);
  }

  /**
   * Check if user has admin flags in metadata
   * This is a secondary check for future database-driven admin management
   */
  private hasAdminMetadata(user: User): boolean {
    const metadata = user.user_metadata || {};
    const appMetadata = (user as any).app_metadata || {};

    return (
      metadata.is_admin === true ||
      appMetadata.is_admin === true ||
      metadata.role === "admin" ||
      appMetadata.role === "admin"
    );
  }

  /**
   * Logging utilities
   */
  private log(message: string, data?: any) {
    if (this.verbose) {
      console.log(`[AdminChecker] ${message}`, data || "");
    }
  }
}

/**
 * Convenience function for quick admin checks without instantiating class
 * Useful for simple validation scenarios
 */
export function isUserAdmin(user: User): boolean {
  const checker = new AdminChecker();
  return checker.checkAdminStatus(user).isAdmin;
}

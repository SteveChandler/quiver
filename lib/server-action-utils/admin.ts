/**
 * Admin Server Action Utilities
 *
 * Provides wrappers for server actions that require admin privileges.
 * All admin operations use the service role client to bypass RLS.
 */

import { assertIsAdmin, getCurrentUser } from "@/lib/auth/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ServerActionResponse } from "@/lib/server-action-utils";

/**
 * Wrap a server action with admin authentication and service role client
 *
 * Usage:
 * ```typescript
 * export const deleteBeach = withAdminAction(
 *   async (beachId: string, { supabaseAdmin }) => {
 *     await supabaseAdmin.from('beaches').delete().eq('id', beachId);
 *     return { success: true };
 *   }
 * );
 * ```
 */
function withAdminAction<TArgs extends any[], TResult>(
  action: (
    ...args: [...TArgs, { supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient> }]
  ) => Promise<TResult>
) {
  return async (...args: TArgs): Promise<ServerActionResponse<TResult>> => {
    try {
      // Check authentication and admin privileges
      const user = await getCurrentUser();
      assertIsAdmin(user);

      // Create service role client for admin operations
      const supabaseAdmin = createSupabaseServiceRoleClient();

      // Execute the action with service role client
      const data = await action(...args, { supabaseAdmin });

      return { success: true, data };
    } catch (error) {
      console.error("Admin server action error:", error);

      // Provide helpful error messages
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      } else if (error && typeof error === "object" && "message" in error) {
        message = String(error.message);
      } else {
        message = "Unknown error occurred";
        console.error("Unhandled error type:", typeof error, error);
      }

      return {
        success: false,
        error: message,
      };
    }
  };
}

/**
 * Alternative admin action wrapper that provides both user and service role client
 *
 * Usage:
 * ```typescript
 * export const auditedDelete = withAdminActionAndUser(
 *   async (beachId: string, { user, supabaseAdmin }) => {
 *     // Log who performed the action
 *     await supabaseAdmin.from('audit_log').insert({
 *       user_id: user.id,
 *       action: 'delete_beach',
 *       entity_id: beachId
 *     });
 *
 *     await supabaseAdmin.from('beaches').delete().eq('id', beachId);
 *     return { success: true };
 *   }
 * );
 * ```
 */
export function withAdminActionAndUser<TArgs extends any[], TResult>(
  action: (
    ...args: [
      ...TArgs,
      {
        user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
        supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>;
      }
    ]
  ) => Promise<TResult>
) {
  return async (...args: TArgs): Promise<ServerActionResponse<TResult>> => {
    try {
      // Check authentication and admin privileges
      const user = await getCurrentUser();
      assertIsAdmin(user);

      // Create service role client for admin operations
      const supabaseAdmin = createSupabaseServiceRoleClient();

      // Execute the action with both user and service role client
      const data = await action(...args, { user, supabaseAdmin });

      return { success: true, data };
    } catch (error) {
      console.error("Admin server action error:", error);

      // Provide helpful error messages
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      } else if (error && typeof error === "object" && "message" in error) {
        message = String(error.message);
      } else {
        message = "Unknown error occurred";
        console.error("Unhandled error type:", typeof error, error);
      }

      return {
        success: false,
        error: message,
      };
    }
  };
}

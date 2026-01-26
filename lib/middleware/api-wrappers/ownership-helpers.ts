/**
 * Ownership Helpers
 *
 * Utilities for checking resource ownership in API handlers.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";

/**
 * Result of ownership check
 */
export type OwnershipResult =
  | { ok: true }
  | { error: NextResponse };

/**
 * Checks if a user owns a resource by querying the database.
 *
 * Returns a 404 if resource not found, 403 if not owned by user.
 *
 * @param supabase - Supabase client
 * @param table - Table name to query
 * @param resourceId - ID of the resource
 * @param userId - ID of the user who should own it
 * @param resourceName - Human-readable name for error messages
 * @returns Ownership result
 *
 * @example
 * ```ts
 * export const DELETE = withAuth(async (request, { params, user, supabase }) => {
 *   const ownership = await requireOwnership(
 *     supabase,
 *     "sessions",
 *     params.id,
 *     user.id,
 *     "Session"
 *   );
 *   if ("error" in ownership) return ownership.error;
 *
 *   // Proceed with deletion
 * });
 * ```
 */
export async function requireOwnership(
  supabase: SupabaseClient<Database>,
  table: keyof Database["public"]["Tables"],
  resourceId: string,
  userId: string,
  resourceName: string = "Resource"
): Promise<OwnershipResult> {
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id, user_id")
    .eq("id", resourceId)
    .single();

  if (existingError) {
    if (existingError.code === "PGRST116") {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: `${resourceName} not found`,
            timestamp: new Date().toISOString(),
          },
          { status: 404, headers: DEFAULT_SECURITY_HEADERS }
        ),
      };
    }
    throw existingError;
  }

  if (!existing || (existing as any).user_id !== userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          timestamp: new Date().toISOString(),
        },
        { status: 403, headers: DEFAULT_SECURITY_HEADERS }
      ),
    };
  }

  return { ok: true };
}

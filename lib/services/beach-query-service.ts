/**
 * Beach Query Service
 *
 * Core database query functions for beaches, extracted from server actions
 * to break circular dependencies (lib -> actions).
 *
 * This module is NOT a server action ("use server" is not applied).
 * It lives in lib/services/ so other lib/ modules can import it
 * without creating circular dependencies through the actions/ layer.
 *
 * @module lib/services/beach-query-service
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { applyBeachCoordinateCorrection } from "@/lib/beach-coordinate-corrections";
import type { ServerActionResponse } from "@/lib/server-action-utils";
import { withServerAction, withPublicDatabaseOperation } from "@/lib/server-action-utils";
import type { Beach } from "@/types/database";

// ---------------------------------------------------------------------------
// Field constants (mirrored from actions/beach/beach-query-actions.ts)
// ---------------------------------------------------------------------------

// Selective field query for beach list - only fetch commonly needed fields
// Updated after 20251025 migrations: location->city, latitude->lat, longitude->lon, region->state
const BEACH_LIST_FIELDS =
  "id, name, slug, city, lat, lon, timezone, state, country, created_at, is_private, break_type, skill_level, average_rating, review_count, description, crowd_tips, wave_tips, best_conditions_prose, seo_indexable, editorial_reviewed_at, editorial_sources";

// Full beach detail fields for single beach queries
const BEACH_DETAIL_FIELDS = "*";

// ---------------------------------------------------------------------------
// getBeachesFromDb
// ---------------------------------------------------------------------------

/**
 * Fetch all beaches from the database.
 *
 * This is the pure query extracted from `getBeaches()` in beach-query-actions.
 * It creates its own Supabase client, runs the query, and returns a
 * `ServerActionResponse<Beach[]>` for drop-in compatibility with existing callers.
 */
export async function getBeachesFromDb(): Promise<ServerActionResponse<Beach[]>> {
  return withServerAction(() =>
    withPublicDatabaseOperation<Beach[]>(async (supabase) => {
      // Use selective fields instead of * to reduce data transfer.
      // Exclude private beaches (is_private = true) and soft-deleted beaches
      // so they don't appear in the sitemap or other public-facing lists.
      const result = await supabase
        .from("beaches")
        .select(BEACH_LIST_FIELDS)
        .or("is_private.is.null,is_private.eq.false")
        .is("deleted_at", null)
        .order("name");

      if (result.error) {
        throw new Error(result.error.message || "Database operation failed");
      }

      return ((result.data ?? []) as Beach[])
        .map(applyBeachCoordinateCorrection)
        .filter((beach) =>
          typeof beach.lat === "number" &&
          Number.isFinite(beach.lat) &&
          typeof beach.lon === "number" &&
          Number.isFinite(beach.lon)
      );
    })
  );
}

// ---------------------------------------------------------------------------
// getBeachByIdFromDb
// ---------------------------------------------------------------------------

/**
 * Fetch a single beach by its ID.
 *
 * Extracted from `getBeachById()` in beach-query-actions.
 */
export async function getBeachByIdFromDb(id: string): Promise<ServerActionResponse<Beach>> {
  return withServerAction(() =>
    withPublicDatabaseOperation<Beach>(async (supabase) => {
      const { data, error } = await supabase
        .from("beaches")
        .select(BEACH_DETAIL_FIELDS)
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message || "Database operation failed");
      if (!data) throw new Error("No data returned from operation");
      return applyBeachCoordinateCorrection(data as Beach);
    })
  );
}

// ---------------------------------------------------------------------------
// getBeachesBySlugFromDb
// ---------------------------------------------------------------------------

/**
 * Fetch 0..N beaches by slug without throwing on 0 results or duplicates.
 *
 * Extracted from `getBeachesBySlug()` in beach-query-actions.
 * Excludes private beaches.
 */
export async function getBeachesBySlugFromDb(slug: string): Promise<ServerActionResponse<Beach[]>> {
  return withServerAction(() =>
    withPublicDatabaseOperation<Beach[]>(async (supabase) => {
      const normalized = slug.trim().toLowerCase();

      if (!normalized) {
        return [];
      }

      const { data, error } = await supabase
        .from("beaches")
        .select(BEACH_DETAIL_FIELDS)
        .eq("slug", normalized)
        .or("is_private.is.null,is_private.eq.false")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data ?? []) as Beach[]).map(applyBeachCoordinateCorrection);
    })
  );
}

// ---------------------------------------------------------------------------
// getFavoriteBeachesFromDb
// ---------------------------------------------------------------------------

/**
 * Fetch a user's favorite beaches from the database.
 *
 * This is an internal service function that bypasses auth checking.
 * It uses a service-role client so it can be called from other lib/
 * modules (e.g. the discovery orchestrator) without going through
 * the authenticated action wrapper.
 *
 * @param userId - The user ID whose favorites to fetch
 */
export async function getFavoriteBeachesFromDb(
  userId: string
): Promise<ServerActionResponse<Beach[]>> {
  try {
    const supabase = createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("favorite_beaches")
      .select(
        `
        id,
        rank,
        beach_id,
        beaches (*)
      `
      )
      .eq("user_id", userId)
      .order("rank", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching favorite beaches from DB:", error);
      return { success: false, error: error.message || "Failed to fetch favorite beaches" };
    }

    // Extract the beaches from the nested structure (preserve order)
    const beaches = (data || [])
      .map((item: any) => item.beaches)
      .filter((beach: any) => beach !== null) as Beach[];

    return { success: true, data: beaches };
  } catch (err) {
    console.error("Error in getFavoriteBeachesFromDb:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

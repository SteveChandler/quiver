"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import type { Beach } from "@/types/database";

// Selective field query for beach list - only fetch commonly needed fields
// Note: Only includes fields that exist in the beaches table schema
// Updated after 20251025 migrations: location→city, latitude→lat, longitude→lon, region→state
// WARNING: Some environments may still use legacy columns (location/region) and may not have updated_at.
// We avoid selecting `updated_at` and fall back to legacy fields on schema-mismatch errors.
const BEACH_LIST_FIELDS =
  "id, name, slug, city, lat, lon, state, country, created_at, is_private";
const BEACH_LIST_FIELDS_LEGACY =
  "id, name, location, region, lat, lon, country, created_at, is_private";

// Full beach detail fields for single beach queries
// Includes all fields from beaches table for comprehensive beach view
const BEACH_DETAIL_FIELDS = "*";

export async function getBeaches() {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    try {
      // Use selective fields instead of * to reduce data transfer
      let result: any = await supabase
        .from("beaches")
        .select(BEACH_LIST_FIELDS)
        .order("name");

      // If schema mismatch (unknown column), retry with legacy field set.
      if (result.error && (result.error as any)?.code === "42703") {
        result = (await supabase
          .from("beaches")
          .select(BEACH_LIST_FIELDS_LEGACY)
          .order("name")) as any;

        // Normalize legacy location/region into city/state for downstream match strategies
        if (Array.isArray((result as any).data)) {
          (result as any).data = (result as any).data.map((b: any) => ({
            ...b,
            city: b.city ?? b.location ?? null,
            state: b.state ?? b.region ?? null,
            slug: b.slug ?? null,
            updated_at: b.updated_at ?? null,
          }));
        }
      }

      return result;
    } catch (err) {
      // Normalize non-Error throws to a standard shape
      return { data: null, error: { message: err instanceof Error ? err.message : "Unknown error" } } as any;
    }
  });
}

export async function getBeachById(id: string) {
  return withDatabaseOperation<Beach>(async (supabase) => {
    // Fetch full details for single beach view
    return supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .eq("id", id)
      .single();
  });
}

export async function getBeachBySlug(slug: string) {
  return withDatabaseOperation<Beach>(async (supabase) => {
    // Slugs are stored lowercase; enforce lowercase match
    const normalized = slug.trim().toLowerCase();
    // Fetch full details for single beach view
    return supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .eq("slug", normalized)
      .single();
  });
}

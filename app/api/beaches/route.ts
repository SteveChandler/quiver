import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin, type AdminUser } from "@/lib/auth/admin";
import { applyBeachCoordinateCorrection } from "@/lib/beach-coordinate-corrections";
import {
  createCachedResponse,
  createSuccessResponse,
  createValidationError,
  handleApiError,
  CacheDuration,
  checkNotModified,
  DEFAULT_SECURITY_HEADERS,
  withBotBlockingAndRateLimit,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

// GET method to retrieve all beaches with optimized caching
async function beachesHandler(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return handleApiError(new Error("Supabase client not initialized"), "Failed to fetch beaches");
    }

    // Selective field query with schema fallback.
    // Some environments still use legacy columns (location/region) and may not have slug/city/state.
    // Also, `updated_at` is not guaranteed on `public.beaches` (we do not select it here).
    const preferredSelect =
      "id, name, slug, city, lat, lon, timezone, state, country, created_at, break_type, skill_level, average_rating, review_count, description, crowd_tips, wave_tips, best_conditions_prose, seo_indexable, editorial_reviewed_at, editorial_sources";
    const legacySelect =
      "id, name, location, region, lat, lon, country, created_at";

    let data: any[] | null = null;
    let error: any = null;

    // Attempt preferred schema first
    {
      const res = await supabase
        .from("beaches")
        .select(preferredSelect)
        .or("is_private.is.null,is_private.eq.false")
        .is("deleted_at", null)
        .order("name");
      data = res.data as any[] | null;
      error = res.error;
    }

    // If schema mismatch (unknown column), fall back to legacy schema
    if (error && (error as any)?.code === "42703") {
      const res = await supabase
        .from("beaches")
        .select(legacySelect)
        .or("is_private.is.null,is_private.eq.false")
        .is("deleted_at", null)
        .order("name");
      data = res.data as any[] | null;
      error = res.error;
    }

    if (error) {
      console.error("Database error:", error);
      return handleApiError(error, "Failed to fetch beaches");
    }

    // Normalize legacy schema fields to the preferred shape for consumers.
    // - city/state from location/region
    // - slug: keep DB slug when present, else omit (null)
    const normalized = (data || [])
      .filter(
        (b: any) =>
          typeof b.lat === "number" &&
          Number.isFinite(b.lat) &&
          typeof b.lon === "number" &&
          Number.isFinite(b.lon)
      )
      .map((b: any) => applyBeachCoordinateCorrection({
        ...b,
        city: b.city ?? b.location ?? null,
        state: b.state ?? b.region ?? null,
        slug: b.slug ?? null,
        // Never promise updated_at here; keep null for backward compatibility
        updated_at: b.updated_at ?? null,
      }));

    const responseData = {
      beaches: normalized,
      count: normalized.length,
    };

    // Check ETag for 304 Not Modified response
    const clientETag = request.headers.get('If-None-Match');
    const notModified = await checkNotModified(clientETag, responseData);
    if (notModified) return notModified;

    // Return cached response with 5min cache + 1hr SWR
    return await createCachedResponse(responseData, CacheDuration.MEDIUM);
  } catch (error) {
    console.error("Error fetching beaches:", error);
    return handleApiError(error, "Failed to fetch beaches");
  }
}

// Apply bot blocking and rate limiting to public GET endpoint
export const GET = withBotBlockingAndRateLimit(beachesHandler, "public-default");

// Matches Ruby LocationsController#create functionality
// POST is admin-protected, so no bot blocking needed
async function beachesPostHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext
): Promise<NextResponse> {
  // Admin check - withAuth already verified user exists
  if (!isAdmin(user as AdminUser)) {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403, headers: DEFAULT_SECURITY_HEADERS }
    );
  }

  const body = await request.json();
  const { id, name, lat, lon } = body;

  if (!name || !lat || !lon) {
    return createValidationError("Name, lat, and lon are required");
  }

  let result;

  if (id) {
    // Update existing location
    result = await supabase
      .from("beaches")
      .update({
        name,
        lat,
        lon,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
  } else {
    // Create new location
    result = await supabase
      .from("beaches")
      .insert({
        name,
        lat,
        lon,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
  }

  if (result.error) {
    console.error("Database error:", result.error);
    return handleApiError(result.error, "Failed to save location");
  }

  return createSuccessResponse({
    id: result.data.id,
    name: result.data.name,
    lat: result.data.lat,
    lon: result.data.lon,
  });
}

export const POST = withAuth(beachesPostHandler, {
  errorMessage: "Failed to save location",
});

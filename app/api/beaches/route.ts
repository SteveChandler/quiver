import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCachedResponse,
  createSuccessResponse,
  createValidationError,
  handleApiError,
  CacheDuration,
  checkNotModified,
} from "@/lib/api-utils";
import { isAdmin } from "@/lib/auth/admin";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

// GET method to retrieve all beaches with optimized caching
async function beachesHandler(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
      return handleApiError(new Error("Supabase client not initialized"), "Failed to fetch beaches");
    }

    // Selective field query with schema fallback.
    // Some environments still use legacy columns (location/region) and may not have slug/city/state.
    // Also, `updated_at` is not guaranteed on `public.beaches` (we do not select it here).
    const preferredSelect =
      "id, name, slug, city, lat, lon, state, country, created_at, is_private";
    const legacySelect =
      "id, name, location, region, lat, lon, country, created_at, is_private";

    let data: any[] | null = null;
    let error: any = null;

    // Attempt preferred schema first
    {
      const res = await supabase
        .from("beaches")
        .select(preferredSelect)
        .order("name");
      data = res.data as any[] | null;
      error = res.error;
    }

    // If schema mismatch (unknown column), fall back to legacy schema
    if (error && (error as any)?.code === "42703") {
      const res = await supabase
        .from("beaches")
        .select(legacySelect)
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
    const normalized = (data || []).map((b: any) => ({
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
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // Admin authentication check - only admins can create/update beaches
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !isAdmin(user as any)) {
      return NextResponse.json({ 
        error: "Unauthorized - Admin access required" 
      }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, lat, lon } = body;

    if (!name || !lat || !lon) {
      return createValidationError(
        "Name, lat, and lon are required"
      );
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
  } catch (error) {
    console.error("Error saving location:", error);
    return handleApiError(error, "Failed to save location");
  }
}

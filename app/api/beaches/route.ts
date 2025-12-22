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
import { withBotBlockingAndRateLimit } from "@/lib/middleware/rate-limiter";

// GET method to retrieve all beaches with optimized caching
async function beachesHandler(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
      return handleApiError(new Error("Supabase client not initialized"), "Failed to fetch beaches");
    }

    // Selective field query - only fetch fields needed by consumers and that exist in schema
    // Includes slug, city, state for hierarchical URL generation
    const { data, error } = await supabase
      .from("beaches")
      .select("id, name, slug, city, lat, lon, state, country, created_at, updated_at, is_private")
      .order("name");

    if (error) {
      console.error("Database error:", error);
      return handleApiError(error, "Failed to fetch beaches");
    }

    const responseData = {
      beaches: data || [],
      count: data?.length || 0,
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
      success: true,
      data: {
        id: result.data.id,
        name: result.data.name,
        lat: result.data.lat,
        lon: result.data.lon,
      },
    });
  } catch (error) {
    console.error("Error saving location:", error);
    return handleApiError(error, "Failed to save location");
  }
}

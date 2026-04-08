import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

// Core handler logic for fetching a single beach
async function fetchBeachById(beachId: string): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (error) {
      return handleApiError(error, "Failed to fetch beach");
    }

    if (!data) {
      return handleApiError(new Error("Beach not found"), "Beach not found");
    }

    // Ensure review_count is always populated. The denormalized
    // beaches.review_count column is sometimes null/stale, which breaks the
    // beach_reviews_empty instrumentation. Recompute live when missing.
    let reviewCount = (data as { review_count?: number | null }).review_count;
    if (typeof reviewCount !== "number") {
      const { count } = await supabase
        .from("beach_reviews")
        .select("id", { count: "exact", head: true })
        .eq("beach_id", beachId)
        .is("deleted_at", null);
      reviewCount = count ?? 0;
    }
    const beachWithCount = { ...data, review_count: reviewCount };

    // PERFORMANCE OPTIMIZATION: Cache beach data for 1 hour (3600s)
    // Beach metadata rarely changes
    const response = createSuccessResponse({ beach: beachWithCount });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );

    return response;
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach");
  }
}

// GET /api/beaches/[id] - fetch a single beach by ID
// Bot blocking and rate limiting applied to prevent abuse
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Wrap the handler with bot blocking and rate limiting
  const wrappedHandler = withBotBlockingAndRateLimit(
    async () => fetchBeachById(id),
    "public-default"
  );

  return wrappedHandler(request);
}

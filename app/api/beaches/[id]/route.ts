import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

// GET /api/beaches/[id] - fetch a single beach by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      return handleApiError(error, "Failed to fetch beach");
    }

    if (!data) {
      return handleApiError(new Error("Beach not found"), "Beach not found");
    }

    // PERFORMANCE OPTIMIZATION: Cache beach data for 1 hour (3600s)
    // Beach metadata rarely changes
    const response = createSuccessResponse({ beach: data });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );

    return response;
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach");
  }
}


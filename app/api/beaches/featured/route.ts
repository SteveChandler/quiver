import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";

/**
 * GET /api/beaches/featured
 * 
 * Returns a curated list of featured beaches for the landing page.
 * Returns beaches for visual display on the landing page.
 * 
 * @returns Array of beach objects with id, name, location data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Fetch beaches - just return the first batch for landing page display
    // Order by name alphabetically for consistent results
    const { data, error } = await supabase
      .from("beaches")
      .select("id, name, location, region")
      .order("name")
      .limit(12); // Get more than needed so we have variety

    if (error) {
      console.error("Database error fetching featured beaches:", error);
      // Return empty array rather than error for graceful degradation
      return createSuccessResponse([]);
    }

    // Return the beaches (component will slice to needed amount and has fallback data)
    return createSuccessResponse(data || []);
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array rather than error for graceful degradation
    return createSuccessResponse([]);
  }
}


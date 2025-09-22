import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

// GET /api/beaches/[id]/sessions?limit=5 - fetch recent completed sessions for beach
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10) || 5, 25);

    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*),
        user:profiles(*)
      `
      )
      .eq("beach_id", params.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return handleApiError(error, "Failed to fetch sessions by beach");
    }

    return createSuccessResponse({ sessions: data || [] });
  } catch (err) {
    return handleApiError(err, "Failed to fetch sessions by beach");
  }
}



import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

// GET /api/beaches/[id]/sources - fetch external source mappings (e.g., camera_url)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beach_sources")
      .select("beach_id, ndbc_buoy_ids, forecast_source_id, camera_url")
      .eq("beach_id", params.id)
      .maybeSingle();

    if (error) {
      return handleApiError(error, "Failed to fetch beach sources");
    }

    return createSuccessResponse({ sources: data || null });
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach sources");
  }
}



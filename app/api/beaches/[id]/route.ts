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

    return createSuccessResponse({ beach: data });
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach");
  }
}


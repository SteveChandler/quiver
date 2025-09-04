import { NextRequest } from "next/server";
import { 
  createSuccessResponse, 
  handleApiError, 
  createValidationError,
  methodNotAllowed,
  isValidUuid,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id: userId } = context.params;
    if (!userId || !isValidUuid(userId)) {
      return createValidationError("Invalid user id format");
    }
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        session:sessions(beach:beaches(name))
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return createSuccessResponse({ comments: data || [] });
  } catch (error) {
    return handleApiError(error, "Failed to load user comments");
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}



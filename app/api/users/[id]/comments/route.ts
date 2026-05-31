import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
  createValidationError,
  methodNotAllowed,
  isValidUuid,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Core handler for fetching user comments
 */
async function fetchUserComments(userId: string): Promise<NextResponse> {
  try {
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

/**
 * GET /api/users/[id]/comments
 * Bot blocking and rate limiting applied to prevent abuse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const wrappedHandler = withBotBlockingAndRateLimit(
    async () => fetchUserComments(id),
    "public-default"
  );

  return wrappedHandler(request);
}

export function POST() {
  return methodNotAllowed(["GET"]);
}

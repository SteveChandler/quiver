import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, createAuthError, createValidationError, methodNotAllowed, isValidUuid } from "@/lib/api-utils";
import { toggleUserFollow } from "@/actions/social-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id: targetUserId } = context.params;
    if (!targetUserId || !isValidUuid(targetUserId)) {
      return createValidationError("Invalid user id format");
    }
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return createAuthError();
    }

    const result = await toggleUserFollow(targetUserId);
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle follow");
    }

    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, "Failed to toggle follow");
  }
}

export function GET() {
  return methodNotAllowed(["POST"]);
}



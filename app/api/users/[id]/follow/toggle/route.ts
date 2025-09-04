import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, createAuthError } from "@/lib/api-utils";
import { toggleUserFollow } from "@/actions/social-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return createAuthError();
    }

    const result = await toggleUserFollow(context.params.id);
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle follow");
    }

    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, "Failed to toggle follow");
  }
}



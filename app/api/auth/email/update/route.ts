import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
  createValidationError,
  createAuthError,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { newEmail } = await request.json().catch(() => ({}));
    if (!newEmail || typeof newEmail !== "string") {
      return createValidationError("newEmail is required");
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return createAuthError();
    }

    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (updateError) throw updateError;

    return createSuccessResponse({ message: "Email update process initiated. Please check your current and new email for confirmation links." });
  } catch (error) {
    return handleApiError(error, "Failed to update email");
  }
}



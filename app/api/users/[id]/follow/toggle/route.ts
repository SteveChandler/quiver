import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

/**
 * POST /api/users/[id]/follow/toggle - Toggle follow status for a user.
 *
 * Writes via the Bearer-aware `supabase` client from the withAuth context so
 * native clients authenticate correctly. The prior implementation delegated
 * to a `"use server"` action which re-authenticated via cookies only, which
 * silently failed for mobile callers.
 */
export const POST = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "user");
    if ("error" in uuidResult) return uuidResult.error;
    const targetUserId = uuidResult.value;

    if (user.id === targetUserId) {
      throw new Error("Cannot follow yourself");
    }

    const { data: existing, error: selectError } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (selectError && selectError.code !== "PGRST116") {
      throw selectError;
    }

    if (existing) {
      const { error: deleteError } = await supabase
        .from("user_follows")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;

      revalidatePath("/profile");
      revalidatePath(`/profile/${targetUserId}`);

      return createSuccessResponse({
        success: true,
        following: false,
        message: "Unfollowed",
      });
    }

    const { error: insertError } = await supabase
      .from("user_follows")
      .insert({ follower_id: user.id, following_id: targetUserId });
    if (insertError) throw insertError;

    revalidatePath("/profile");
    revalidatePath(`/profile/${targetUserId}`);

    return createSuccessResponse({
      success: true,
      following: true,
      message: "Now following",
    });
  },
  { errorMessage: "Failed to toggle follow" },
);

export function GET() {
  return methodNotAllowed(["POST"]);
}

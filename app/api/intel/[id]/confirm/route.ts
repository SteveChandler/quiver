import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  validateUuidParam,
  createValidationError,
  createNotFoundError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

/**
 * Intel Post Confirmation API
 *
 * POST /api/intel/[id]/confirm - Confirm an intel post
 * DELETE /api/intel/[id]/confirm - Remove confirmation from an intel post
 */

/**
 * POST /api/intel/[id]/confirm
 * Adds a user confirmation to an intel post
 */
export const POST = withAuth(
  async (_request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    // Validate UUID parameter
    const uuidResult = validateUuidParam(params.id, "intel");
    if ("error" in uuidResult) return uuidResult.error;
    const intelPostId = uuidResult.value;

    // Check if intel post exists and is active
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id, is_active, expires_at")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return createNotFoundError("Intel post");
    }

    if (!intelPost.is_active) {
      return createValidationError("Intel post is no longer active");
    }

    // Check if post has expired
    if (intelPost.expires_at && new Date(intelPost.expires_at) < new Date()) {
      return createValidationError("Intel post has expired");
    }

    // Prevent users from confirming their own posts
    if (intelPost.user_id === user.id) {
      return createValidationError("You cannot confirm your own intel post");
    }

    // Check if user has already confirmed this post
    const { data: existingConfirmation, error: checkError } = await supabase
      .from("intel_post_confirmations")
      .select("id")
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows found
      console.error("Error checking existing confirmation:", checkError);
      throw checkError;
    }

    if (existingConfirmation) {
      return createValidationError("You have already confirmed this intel post");
    }

    // Create confirmation
    const { data: confirmation, error: confirmError } = await supabase
      .from("intel_post_confirmations")
      .insert({
        intel_post_id: intelPostId,
        user_id: user.id,
      })
      .select()
      .single();

    if (confirmError) {
      console.error("Error creating confirmation:", confirmError);
      throw confirmError;
    }

    // Get updated confirmations count
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.error("Error fetching updated count:", updateError);
      // Don't fail the request, just return the confirmation
    }

    return createSuccessResponse({
      confirmed: true,
      confirmations_count: updatedPost?.confirmations_count || 0,
      confirmation_id: confirmation.id,
    });
  },
  { errorMessage: "Failed to confirm intel post" }
);

/**
 * DELETE /api/intel/[id]/confirm
 * Removes a user confirmation from an intel post
 */
export const DELETE = withAuth(
  async (_request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    // Validate UUID parameter
    const uuidResult = validateUuidParam(params.id, "intel");
    if ("error" in uuidResult) return uuidResult.error;
    const intelPostId = uuidResult.value;

    // Check if intel post exists
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return createNotFoundError("Intel post");
    }

    // Find and delete the user's confirmation
    const { data: deletedConfirmation, error: deleteError } = await supabase
      .from("intel_post_confirmations")
      .delete()
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (deleteError) {
      if (deleteError.code === "PGRST116") {
        // No rows found
        return createValidationError("You have not confirmed this intel post");
      }
      console.error("Error deleting confirmation:", deleteError);
      throw deleteError;
    }

    // Get updated confirmations count
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.error("Error fetching updated count:", updateError);
      // Don't fail the request, just return the confirmation
    }

    return createSuccessResponse({
      confirmed: false,
      confirmations_count: updatedPost?.confirmations_count || 0,
      confirmation_id: deletedConfirmation.id,
    });
  },
  { errorMessage: "Failed to remove intel post confirmation" }
);

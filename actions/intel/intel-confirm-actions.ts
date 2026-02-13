"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { creditAuthorWithXP } from "@/lib/gamification";
import type { ActionResult } from "@/lib/action-utils";
import type { ConfirmationData } from "./intel-types";

/**
 * Confirm an intel post
 */
export async function confirmIntelPost(
  intelPostId: string
): Promise<ActionResult<ConfirmationData>> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Check if intel post exists and is active
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id, is_active, expires_at")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return {
        success: false,
        error: "Intel post not found",
      };
    }

    if (!intelPost.is_active) {
      return {
        success: false,
        error: "Intel post is no longer active",
      };
    }

    // Check if post has expired
    if (intelPost.expires_at && new Date(intelPost.expires_at) < new Date()) {
      return {
        success: false,
        error: "Intel post has expired",
      };
    }

    // Prevent users from confirming their own posts
    if (intelPost.user_id === user.id) {
      return {
        success: false,
        error: "You cannot confirm your own intel post",
      };
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
      return {
        success: false,
        error: "Failed to check confirmation status",
      };
    }

    if (existingConfirmation) {
      return {
        success: false,
        error: "You have already confirmed this intel post",
      };
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
      return {
        success: false,
        error: "Failed to confirm intel post",
      };
    }

    // Get updated confirmations count - add a small delay to ensure trigger has executed
    await new Promise(resolve => setTimeout(resolve, 100));

    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.warn("Could not fetch updated confirmations count:", updateError);
    }

    // Credit the intel author with XP (async, don't block the response)
    if (intelPost.user_id) {
      creditAuthorWithXP(intelPost.user_id, 'intel_post', intelPostId).catch(err =>
        console.error("Failed to credit intel author XP:", err)
      );

      // Fire-and-forget milestone check for the post author (intel_confirmed_5x)
      import("@/lib/services/personalization-milestone-service")
        .then(({ checkAndRecordMilestones }) => checkAndRecordMilestones(intelPost.user_id))
        .catch(() => {});
    }

    // Revalidate the home page to refresh the intel feed
    revalidatePath("/");

    return {
      success: true,
      data: {
        confirmed: true,
        confirmations_count: updatedPost?.confirmations_count || 1, // Fallback to at least 1 since we just added a confirmation
        confirmation_id: confirmation.id,
      },
    };
  } catch (error) {
    console.error("Error in confirmIntelPost:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to confirm intel post",
    };
  }
}

/**
 * Remove confirmation from an intel post
 */
export async function removeIntelPostConfirmation(
  intelPostId: string
): Promise<ActionResult<ConfirmationData>> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Check if intel post exists
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return {
        success: false,
        error: "Intel post not found",
      };
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
        return {
          success: false,
          error: "You have not confirmed this intel post",
        };
      }
      console.error("Error deleting confirmation:", deleteError);
      return {
        success: false,
        error: "Failed to remove confirmation",
      };
    }

    // Get updated confirmations count - add a small delay to ensure trigger has executed
    await new Promise(resolve => setTimeout(resolve, 100));

    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.warn("Could not fetch updated confirmations count:", updateError);
    }

    // Revalidate the home page to refresh the intel feed
    revalidatePath("/");

    return {
      success: true,
      data: {
        confirmed: false,
        confirmations_count: updatedPost?.confirmations_count || 0,
        confirmation_id: deletedConfirmation.id,
      },
    };
  } catch (error) {
    console.error("Error in removeIntelPostConfirmation:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove intel post confirmation",
    };
  }
}

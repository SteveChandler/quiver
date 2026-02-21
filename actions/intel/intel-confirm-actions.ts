"use server";

import type { ActionResult } from "@/lib/action-utils";
import type { ConfirmationData } from "./intel-types";
import { voteOnIntelPost, removeIntelVote } from "./intel-vote-actions";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * Confirm an intel post (backward-compat wrapper).
 * Delegates to the 3-way voting system with vote_type='confirmed'.
 *
 * Note: `confirmation_id` returns the intel post ID rather than a
 * separate confirmation record ID. This is a known semantic change
 * from the migration away from the dedicated `intel_confirmations`
 * table to the unified `intel_votes` system. Callers should treat
 * the value as opaque and not rely on it pointing to a specific row
 * in any table.
 */
export async function confirmIntelPost(
  intelPostId: string
): Promise<ActionResult<ConfirmationData>> {
  const result = await voteOnIntelPost(intelPostId, "confirmed");

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      confirmed: true,
      confirmations_count: result.data?.confirmed_count ?? 0,
      /** @see confirmIntelPost JSDoc — returns the post ID, not a confirmation row ID */
      confirmation_id: intelPostId,
    },
  };
}

/**
 * Remove confirmation from an intel post (backward-compat wrapper).
 *
 * Only removes the user's vote if its type is `confirmed`. If the user
 * has a different vote type (helpful, off) it is left intact because
 * removing a non-confirmation vote through this function would be a
 * semantic error — the caller intended to un-confirm, not un-vote.
 */
export async function removeIntelPostConfirmation(
  intelPostId: string
): Promise<ActionResult<ConfirmationData>> {
  const uuidResult = uuidSchema.safeParse(intelPostId);
  if (!uuidResult.success) return { success: false, error: "Invalid intel post ID" };

  return withAuthenticatedAction(async (user, supabase) => {
    // Check the user's current vote type before removing
    const { data: existingVote, error: checkError } = await supabase
      .from("intel_votes")
      .select("id, vote_type")
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing vote:", checkError);
      throw new Error("Failed to check vote status");
    }

    // Only remove if the vote is a confirmation; otherwise leave it as-is
    if (!existingVote || existingVote.vote_type !== "confirmed") {
      const { data: currentPost } = await supabase
        .from("intel_posts")
        .select("confirmed_count")
        .eq("id", intelPostId)
        .single();

      return {
        confirmed: false,
        confirmations_count: currentPost?.confirmed_count ?? 0,
        confirmation_id: intelPostId,
      };
    }

    // Delegate to removeIntelVote for the actual deletion
    const result = await removeIntelVote(intelPostId);

    if (!result.success) {
      throw new Error(result.error || "Failed to remove confirmation");
    }

    return {
      confirmed: false,
      confirmations_count: result.data?.confirmed_count ?? 0,
      confirmation_id: intelPostId,
    };
  });
}

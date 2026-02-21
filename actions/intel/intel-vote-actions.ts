"use server";

import { revalidatePath } from "next/cache";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { creditAuthorWithXP } from "@/lib/gamification";
import { uuidSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/action-utils";
import type { IntelVoteType, VoteData } from "./intel-types";

/**
 * Cast or change a vote on an intel post (UPSERT).
 * One vote per user per post. Calling again with same type is a no-op,
 * calling with different type changes it.
 */
export async function voteOnIntelPost(
  intelPostId: string,
  voteType: IntelVoteType
): Promise<ActionResult<VoteData>> {
  const uuidResult = uuidSchema.safeParse(intelPostId);
  if (!uuidResult.success) return { success: false, error: "Invalid intel post ID" };

  return withAuthenticatedAction(async (user, supabase) => {
    // Check if intel post exists and is active
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id, is_active, expires_at")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      throw new Error("Intel post not found");
    }

    if (!intelPost.is_active) {
      throw new Error("Intel post is no longer active");
    }

    if (intelPost.expires_at && new Date(intelPost.expires_at) < new Date()) {
      throw new Error("Intel post has expired");
    }

    // Prevent voting on own posts
    if (intelPost.user_id === user.id) {
      throw new Error("You cannot vote on your own intel post");
    }

    // Check for existing vote before writing.
    // This read-before-write is intentional: we need the existing vote to
    // (a) no-op when the same type is re-submitted, and
    // (b) determine whether this is a first vote so XP is awarded only once.
    // A UNIQUE constraint on (intel_post_id, user_id) in the database prevents
    // duplicate rows even if two requests race, and the UI isVoting guard makes
    // the double-click scenario extremely unlikely in practice.
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

    let isFirstVote = false;

    if (existingVote) {
      // Same vote type — no-op
      if (existingVote.vote_type === voteType) {
        // Fetch current counts and return
        const { data: post } = await supabase
          .from("intel_posts")
          .select("helpful_count, off_count, confirmed_count")
          .eq("id", intelPostId)
          .single();

        return {
          vote_type: voteType,
          helpful_count: post?.helpful_count ?? 0,
          off_count: post?.off_count ?? 0,
          confirmed_count: post?.confirmed_count ?? 0,
        };
      }

      // Different vote type — update
      const { error: updateError } = await supabase
        .from("intel_votes")
        .update({ vote_type: voteType })
        .eq("id", existingVote.id);

      if (updateError) {
        console.error("Error updating vote:", updateError);
        throw new Error("Failed to update vote");
      }
    } else {
      // No existing vote — insert
      isFirstVote = true;
      const { error: insertError } = await supabase
        .from("intel_votes")
        .insert({
          intel_post_id: intelPostId,
          user_id: user.id,
          vote_type: voteType,
        });

      if (insertError) {
        console.error("Error casting vote:", insertError);
        throw new Error("Failed to cast vote");
      }
    }

    // Fetch updated counts immediately (UI already does optimistic updates)
    const { data: updatedPost } = await supabase
      .from("intel_posts")
      .select("helpful_count, off_count, confirmed_count")
      .eq("id", intelPostId)
      .single();

    // Award XP on first vote only, and only for positive vote types
    if (isFirstVote && (voteType === "helpful" || voteType === "confirmed") && intelPost.user_id) {
      creditAuthorWithXP(intelPost.user_id, "intel_post", intelPostId).catch(err =>
        console.error("Failed to credit intel author XP:", err)
      );
    }

    revalidatePath("/");

    return {
      vote_type: voteType,
      helpful_count: updatedPost?.helpful_count ?? 0,
      off_count: updatedPost?.off_count ?? 0,
      confirmed_count: updatedPost?.confirmed_count ?? 0,
    };
  });
}

/**
 * Remove a user's vote from an intel post.
 *
 * Intentionally idempotent: if the user has no vote on the post, returns
 * the current counts with `vote_type: null` instead of throwing. This
 * prevents UI race conditions where the client fires a remove after the
 * vote was already cleared (e.g., double-tap, optimistic rollback).
 */
export async function removeIntelVote(
  intelPostId: string
): Promise<ActionResult<VoteData>> {
  const uuidResult = uuidSchema.safeParse(intelPostId);
  if (!uuidResult.success) return { success: false, error: "Invalid intel post ID" };

  return withAuthenticatedAction(async (user, supabase) => {
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      throw new Error("Intel post not found");
    }

    // Check if a vote exists before attempting delete (idempotent no-op if absent)
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

    if (!existingVote) {
      // No vote to remove — return current counts as-is (idempotent success)
      const { data: currentPost } = await supabase
        .from("intel_posts")
        .select("helpful_count, off_count, confirmed_count")
        .eq("id", intelPostId)
        .single();

      return {
        vote_type: null,
        helpful_count: currentPost?.helpful_count ?? 0,
        off_count: currentPost?.off_count ?? 0,
        confirmed_count: currentPost?.confirmed_count ?? 0,
      };
    }

    const { error: deleteError } = await supabase
      .from("intel_votes")
      .delete()
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error removing vote:", deleteError);
      throw new Error("Failed to remove vote");
    }

    // Fetch updated counts immediately (UI already does optimistic updates)
    const { data: updatedPost } = await supabase
      .from("intel_posts")
      .select("helpful_count, off_count, confirmed_count")
      .eq("id", intelPostId)
      .single();

    revalidatePath("/");

    return {
      vote_type: null,
      helpful_count: updatedPost?.helpful_count ?? 0,
      off_count: updatedPost?.off_count ?? 0,
      confirmed_count: updatedPost?.confirmed_count ?? 0,
    };
  });
}

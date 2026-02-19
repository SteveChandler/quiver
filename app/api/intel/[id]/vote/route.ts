import type { NextRequest } from "next/server";
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  validateUuidParam,
  createValidationError,
  createNotFoundError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { IntelVoteSchema } from "@/lib/validation/schemas";
import { validateOrError } from "@/lib/api-utils";
import { fromIntelVotes, selectIntelVoteCounts } from "@/lib/supabase/intel-votes-query";

export const dynamic = "force-dynamic";

/**
 * POST /api/intel/[id]/vote
 * Cast or change a vote on an intel post
 */
export const POST = withRateLimit(withAuth(
  async (request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "intel");
    if ("error" in uuidResult) return uuidResult.error;
    const intelPostId = uuidResult.value;

    // Parse and validate body
    const parseResult = await parseAndValidateJson(request);
    if ("error" in parseResult) return parseResult.error;

    const validationResult = validateOrError(IntelVoteSchema, parseResult.data);
    if ("error" in validationResult) return validationResult.error;

    const { vote_type } = validationResult.data;

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

    if (intelPost.expires_at && new Date(intelPost.expires_at) < new Date()) {
      return createValidationError("Intel post has expired");
    }

    if (intelPost.user_id === user.id) {
      return createValidationError("You cannot vote on your own intel post");
    }

    // Check for existing vote
    const { data: existingVote, error: checkError } = await fromIntelVotes(supabase)
      .select("id, vote_type")
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing vote:", checkError);
      throw checkError;
    }

    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // Same vote -- return current state
        const counts = await selectIntelVoteCounts(supabase, intelPostId);
        return createSuccessResponse({ vote_type, ...counts });
      }

      // Different vote type -- update
      const { error: updateError } = await fromIntelVotes(supabase)
        .update({ vote_type })
        .eq("id", existingVote.id);

      if (updateError) {
        console.error("Error updating vote:", updateError);
        throw updateError;
      }
    } else {
      // Insert new vote
      const { error: insertError } = await fromIntelVotes(supabase)
        .insert({
          intel_post_id: intelPostId,
          user_id: user.id,
          vote_type,
        });

      if (insertError) {
        console.error("Error casting vote:", insertError);
        throw insertError;
      }
    }

    // Fetch updated counts
    const counts = await selectIntelVoteCounts(supabase, intelPostId);

    return createSuccessResponse({ vote_type, ...counts });
  },
  { errorMessage: "Failed to vote on intel post" }
), "authenticated-default");

/**
 * DELETE /api/intel/[id]/vote
 * Remove a vote from an intel post
 */
export const DELETE = withRateLimit(withAuth(
  async (_request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "intel");
    if ("error" in uuidResult) return uuidResult.error;
    const intelPostId = uuidResult.value;

    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return createNotFoundError("Intel post");
    }

    const { error: deleteError } = await fromIntelVotes(supabase)
      .delete()
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error removing vote:", deleteError);
      throw deleteError;
    }

    const counts = await selectIntelVoteCounts(supabase, intelPostId);

    return createSuccessResponse({ vote_type: null, ...counts });
  },
  { errorMessage: "Failed to remove vote" }
), "authenticated-default");

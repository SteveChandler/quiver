/**
 * Intel Votes Query Helper
 *
 * Provides type-safe access to the `intel_votes` table and the voting-related
 * columns on `intel_posts` (`helpful_count`, `off_count`, `confirmed_count`).
 *
 * These were added by migration but are not yet in `types/database.generated.ts`.
 * Once types are regenerated, this file can be deleted and callers can use
 * `supabase.from("intel_votes")` directly.
 *
 * TODO: Remove after running `supabase gen types` to regenerate database types.
 *
 * @module lib/supabase/intel-votes-query
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ---------------------------------------------------------------------------
// intel_votes row types (mirrors the DB migration schema)
// ---------------------------------------------------------------------------

export interface IntelVoteRow {
  id: string;
  intel_post_id: string;
  user_id: string;
  vote_type: "helpful" | "off" | "confirmed";
  created_at: string;
}

export interface IntelVoteInsert {
  intel_post_id: string;
  user_id: string;
  vote_type: "helpful" | "off" | "confirmed";
}

export interface IntelVoteUpdate {
  vote_type?: "helpful" | "off" | "confirmed";
}

// ---------------------------------------------------------------------------
// Query helpers — narrow the `as any` to the `.from()` call only
// ---------------------------------------------------------------------------

type TypedSupabase = SupabaseClient<Database>;

/**
 * Returns a query builder for the `intel_votes` table.
 *
 * Usage:
 * ```ts
 * const { data, error } = await fromIntelVotes(supabase)
 *   .select("id, vote_type")
 *   .eq("user_id", userId)
 *   .maybeSingle();
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: remove after type regen
export function fromIntelVotes(client: TypedSupabase): any {
  return (client as any).from("intel_votes");
}

/**
 * Selects the voting-count columns from `intel_posts` that are not yet in
 * generated types.  Falls back to `confirmations_count` which IS in the types.
 *
 * Returns `{ helpful_count, off_count, confirmed_count }` (all default 0).
 */
export async function selectIntelVoteCounts(
  client: TypedSupabase,
  intelPostId: string
): Promise<{ helpful_count: number; off_count: number; confirmed_count: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: remove after type regen
  const { data, error } = await (client as any)
    .from("intel_posts")
    .select("helpful_count, off_count, confirmed_count")
    .eq("id", intelPostId)
    .single();

  if (error) {
    console.error("selectIntelVoteCounts: failed to fetch vote counts", {
      intelPostId,
      code: error.code,
      message: error.message,
    });
    throw new Error(`Failed to fetch vote counts for intel post ${intelPostId}`);
  }

  return {
    helpful_count: data?.helpful_count ?? 0,
    off_count: data?.off_count ?? 0,
    confirmed_count: data?.confirmed_count ?? 0,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

type SocialProofSupabase = Pick<SupabaseClient<Database>, "from">;

export interface SocialProofCounts {
  totalSurfers: number;
  joinedLast7d: number;
}

const REAL_PROFILE_FILTERS = {
  analyticsIsRealUser: true,
  deletedAt: null,
} as const;

function realProfileCountQuery(supabase: SocialProofSupabase) {
  return supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("analytics_is_real_user", REAL_PROFILE_FILTERS.analyticsIsRealUser)
    .or("is_system_account.is.null,is_system_account.eq.false")
    .is("deleted_at", REAL_PROFILE_FILTERS.deletedAt);
}

function toSupabaseCountError(label: string, error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "Unknown Supabase error";

  return new Error(`Failed to count ${label}: ${message}`, { cause: error });
}

export async function countRealSurfers(
  supabase: SocialProofSupabase,
  now: Date = new Date()
): Promise<SocialProofCounts> {
  const joinedSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalResult, joinedResult] = await Promise.all([
    realProfileCountQuery(supabase),
    realProfileCountQuery(supabase).gte("created_at", joinedSince.toISOString()),
  ]);

  if (totalResult.error) {
    throw toSupabaseCountError("real surfers", totalResult.error);
  }

  if (joinedResult.error) {
    throw toSupabaseCountError(
      "real surfers joined in the last 7 days",
      joinedResult.error
    );
  }

  return {
    totalSurfers: totalResult.count ?? 0,
    joinedLast7d: joinedResult.count ?? 0,
  };
}

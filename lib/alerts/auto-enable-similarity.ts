import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

export type AutoEnableSimilarityResult =
  | { created: true }
  | {
      created: false;
      reason:
        | "no_home_beach"
        | "already_exists"
        | "insufficient_signal"
        | "lookup_failed"
        | "insert_failed";
      error?: string;
    };

const RULE_NAME = "Conditions like your best sessions";
const MIN_PROFILE_SESSION_COUNT = 5;
const MIN_POSITIVE_SESSION_COUNT = 3;

async function countLearnedSessions(
  supabase: SupabaseClient<Database>,
  userId: string,
  minimumRating?: number,
): Promise<{ count: number; error?: string }> {
  const baseQuery = supabase
    .from("sessions")
    .select("id, session_forecast_snapshots!inner(forecast_snapshot)", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("rating", "is", null)
    .is("deleted_at", null)
    .not("session_forecast_snapshots.forecast_snapshot", "is", null);

  const query =
    typeof minimumRating === "number"
      ? baseQuery.gte("rating", minimumRating)
      : baseQuery;

  const { count, error } = await query;
  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0 };
}

async function loadSimilaritySignalCounts(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<
  | { profileSessionCount: number; positiveSessionCount: number }
  | { error: string }
> {
  const [profile, positive] = await Promise.all([
    countLearnedSessions(supabase, userId),
    countLearnedSessions(supabase, userId, 4),
  ]);

  if (profile.error) return { error: profile.error };
  if (positive.error) return { error: positive.error };

  return {
    profileSessionCount: profile.count,
    positiveSessionCount: positive.count,
  };
}

/**
 * Idempotently ensures a `similarity_match` alert rule exists for the given
 * user, scoped to their home beach. Called from the RevenueCat webhook after
 * an entitlement upsert that lands the user in is_pro=true OR is_trialing=true,
 * and mirrors the migration-time backfill in
 * `supabase/migrations/20260503210949_auto_enable_similarity_for_pro.sql`.
 *
 * Contract:
 *   - If `profiles.home_beach_id` is NULL → no-op (we don't auto-create rules
 *     pointing at a missing beach; the webhook will fire again on future
 *     entitlement events). NB: setting a home beach later does NOT currently
 *     re-trigger this helper — accepted edge for v1.
 *   - If the user has ANY `similarity_match` row in alert_rules (regardless
 *     of enabled or auto_created_at) → no-op. This is the deletion-respect
 *     contract: a user who once had the rule and deleted it stays opted out,
 *     AND a user who manually created their own rule isn't double-tracked.
 *   - Otherwise → INSERT one row with notify_push=true, notify_email=false,
 *     enabled=true, conditions={}, auto_created_at=now().
 *   - Auto-create only after the same minimum learned-signal contract the
 *     match-score RPC relies on: at least 5 completed rated sessions with
 *     forecast snapshots, including at least 3 positive rated sessions.
 *
 * Non-throwing: returns a structured result so the webhook can log the
 * outcome and ALWAYS return 200 to RevenueCat. The user_entitlements upsert
 * is the load-bearing step; this auto-enable is best-effort.
 *
 * Uses a service-role client (the webhook calls
 * `createSupabaseServiceRoleClient`) so RLS is bypassed — both the profile
 * lookup and the alert_rules insert run as service_role, matching how the
 * webhook already writes the user_entitlements row.
 */
export async function ensureSimilarityRuleForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AutoEnableSimilarityResult> {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("home_beach_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    return { created: false, reason: "lookup_failed", error: profileErr.message };
  }

  const homeBeachId = profile?.home_beach_id ?? null;
  if (!homeBeachId) {
    return { created: false, reason: "no_home_beach" };
  }

  const { count, error: countErr } = await supabase
    .from("alert_rules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("preset_type", "similarity_match");

  if (countErr) {
    return { created: false, reason: "lookup_failed", error: countErr.message };
  }

  if ((count ?? 0) > 0) {
    return { created: false, reason: "already_exists" };
  }

  const signal = await loadSimilaritySignalCounts(supabase, userId);
  if ("error" in signal) {
    return { created: false, reason: "lookup_failed", error: signal.error };
  }

  if (
    signal.profileSessionCount < MIN_PROFILE_SESSION_COUNT ||
    signal.positiveSessionCount < MIN_POSITIVE_SESSION_COUNT
  ) {
    return { created: false, reason: "insufficient_signal" };
  }

  // `as any` on the insert payload: the `auto_created_at` column is added by
  // the same migration that ships this helper (20260503210949_auto_enable_similarity_for_pro.sql)
  // and isn't in `database.generated.ts` yet — types regen happens in a
  // follow-up after the migration applies on prod. Same boundary pattern the
  // RC webhook uses on its user_entitlements upsert.
  const { error: insertErr } = await (supabase as any)
    .from("alert_rules")
    .insert({
      user_id: userId,
      beach_id: homeBeachId,
      name: RULE_NAME,
      preset_type: "similarity_match",
      conditions: {},
      notify_email: false,
      notify_push: true,
      enabled: true,
      auto_created_at: new Date().toISOString(),
    });

  if (insertErr) {
    return { created: false, reason: "insert_failed", error: insertErr.message };
  }

  return { created: true };
}

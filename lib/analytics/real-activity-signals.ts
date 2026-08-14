import type { SupabaseServiceClient } from "@/types/supabase";

export const REAL_ACTIVITY_SIGNAL_THRESHOLD = 5;

export interface RealActivitySignals {
  watchers: number;
  recentChecks: number;
  loggedSessions: number;
}

export interface VisibleRealActivitySignals {
  watchers: number | null;
  recentChecks: number | null;
  loggedSessions: number | null;
}

export function suppressSmallActivitySignals(
  signals: RealActivitySignals,
  threshold = REAL_ACTIVITY_SIGNAL_THRESHOLD,
): VisibleRealActivitySignals {
  return {
    watchers: signals.watchers >= threshold ? signals.watchers : null,
    recentChecks: signals.recentChecks >= threshold ? signals.recentChecks : null,
    loggedSessions: signals.loggedSessions >= threshold ? signals.loggedSessions : null,
  };
}

export async function fetchRealActivitySignals(
  supabase: SupabaseServiceClient,
  beachId: string,
  asOf: Date = new Date(),
): Promise<RealActivitySignals> {
  const since7d = new Date(asOf.getTime() - 7 * 86400000).toISOString();
  const since30d = new Date(asOf.getTime() - 30 * 86400000).toISOString();

  const [alertResult, eventResult, sessionResult] = await Promise.all([
    supabase
      .from("alert_rules")
      .select("user_id")
      .eq("beach_id", beachId)
      .eq("enabled", true),
    supabase
      .from("user_events")
      .select("id, user_id")
      .eq("beach_id", beachId)
      .in("event_type", ["beach_view", "page_view", "forecast_check"])
      .gte("created_at", since7d)
      .or("bot_flagged.is.null,bot_flagged.eq.false"),
    supabase
      .from("sessions")
      .select("id, user_id")
      .eq("beach_id", beachId)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("created_at", since30d),
  ]);

  const alertRows = alertResult.data ?? [];
  const sessionRows = sessionResult.data ?? [];
  const ownerIds = uniqueIds([
    ...alertRows.map((row) => row.user_id),
    ...(eventResult.data ?? []).map((row) => row.user_id),
    ...sessionRows.map((row) => row.user_id),
  ]);
  const realOwnerIds = await fetchRealOwnerIds(supabase, ownerIds);
  const realOwnerSet = new Set(realOwnerIds);

  return {
    watchers: new Set(
      alertRows
        .filter((row) => realOwnerSet.has(row.user_id))
        .map((row) => row.user_id),
    ).size,
    recentChecks: eventResult.error
      ? 0
      : (eventResult.data ?? []).filter(
        (row) => row.user_id !== null && realOwnerSet.has(row.user_id),
      ).length,
    loggedSessions: sessionResult.error
      ? 0
      : sessionRows.filter((row) => realOwnerSet.has(row.user_id)).length,
  };
}

async function fetchRealOwnerIds(
  supabase: SupabaseServiceClient,
  ownerIds: readonly string[],
): Promise<string[]> {
  if (ownerIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_mock, is_system_account")
    .in("id", ownerIds);
  if (error) return [];
  return (data ?? [])
    .filter((profile) => profile.is_mock !== true && profile.is_system_account !== true)
    .map((profile) => profile.id);
}

function uniqueIds(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

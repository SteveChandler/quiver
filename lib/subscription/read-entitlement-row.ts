import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeatureAccess } from "@/lib/flags/founding-access";

interface EntitlementRowData {
  is_pro: boolean | null;
  is_trialing: boolean | null;
  billing_issue: boolean | null;
  expires_at: string | null;
}

/**
 * `ok` with `row: null` is a read that found no row: the user is free.
 * `unknown` is a read that failed twice: the plan is not known, and callers
 * must neither demote the user to free copy nor grant paid features.
 */
type EntitlementRowRead =
  | { status: "ok"; row: EntitlementRowData | null }
  | { status: "unknown"; error: unknown };

/**
 * Feature access for a plan that is not known. Not resolved through the
 * founding access switch: a failed read must never open a paid gate.
 */
export const UNKNOWN_PLAN_FEATURE_ACCESS: FeatureAccess = Object.freeze({
  isPro: false,
  foundingAccess: false,
  hasFeatureAccess: false,
});

const REPORT_WINDOW_MS = 5 * 60 * 1000;
let lastReportedAt: number | null = null;

/**
 * Reads the user's `user_entitlements` row and retries once on a PostgREST
 * error. supabase-js returns network failures as `{ error }` too, so a thrown
 * value is a programming error and propagates.
 */
export async function readEntitlementRow(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<EntitlementRowRead> {
  let error: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await supabase
      .from("user_entitlements")
      .select("is_pro, is_trialing, billing_issue, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!result.error) {
      return { status: "ok", row: (result.data as EntitlementRowData | null) ?? null };
    }
    error = result.error;
  }
  reportUnknownPlan(error);
  return { status: "unknown", error };
}

// One report per window per process: an outage would otherwise send one event per request.
function reportUnknownPlan(error: unknown): void {
  const now = Date.now();
  if (lastReportedAt !== null && now - lastReportedAt < REPORT_WINDOW_MS) return;
  lastReportedAt = now;
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error);
  console.warn("[entitlement-read] user_entitlements read failed twice:", message);
  Sentry.captureException(new Error(`user_entitlements read failed: ${message}`, { cause: error }), {
    level: "warning",
    tags: { area: "entitlement-read" },
  });
}

export function resetEntitlementReadReportingForTests(): void {
  lastReportedAt = null;
}

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

/** Per try. PostgREST cancels a statement at 8 s; a user route must not wait that long twice. */
export const ENTITLEMENT_READ_TIMEOUT_MS = 2500;

// Module state: the real bound is one event per warm server instance per window.
const REPORT_WINDOW_MS = 5 * 60 * 1000;
let lastReportedAt: number | null = null;

interface ReadError {
  code?: string;
  message?: string;
}

const TIMED_OUT: ReadError = { code: "entitlement_read_timeout", message: "user_entitlements read timed out" };

/**
 * A second try can help only when the request never reached a healthy
 * database: a dropped connection (Postgres class 08) or a network failure,
 * which supabase-js returns with an empty code. A timeout (57014, or our own
 * bound) is not retried, so the total wait stays bounded; permission,
 * multiple-row and other errors fail at once.
 */
function isRetryable(error: ReadError): boolean {
  const code = error.code ?? "";
  if (code.startsWith("08")) return true;
  return code === "" && /fetch failed|network|ECONNRESET|socket/i.test(error.message ?? "");
}

async function readOnce(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<{ data: unknown; error: ReadError | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ data: null; error: ReadError }>((resolve) => {
    timer = setTimeout(() => resolve({ data: null, error: TIMED_OUT }), ENTITLEMENT_READ_TIMEOUT_MS);
  });
  const read = supabase
    .from("user_entitlements")
    .select("is_pro, is_trialing, billing_issue, expires_at")
    .eq("user_id", userId)
    .maybeSingle() as unknown as Promise<{ data: unknown; error: ReadError | null }>;
  try {
    return await Promise.race([read, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the user's `user_entitlements` row. Retries once only on a transient
 * connection or network error; each try is bounded by ENTITLEMENT_READ_TIMEOUT_MS.
 * A thrown value is a programming error and propagates.
 */
export async function readEntitlementRow(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<EntitlementRowRead> {
  let error: ReadError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await readOnce(supabase, userId);
    if (!result.error) {
      return { status: "ok", row: (result.data as EntitlementRowData | null) ?? null };
    }
    error = result.error;
    if (!isRetryable(error)) break;
  }
  reportUnknownPlan(error);
  return { status: "unknown", error };
}

// Code and message only: a PostgREST error's details or hint must not carry the user filter into Sentry.
function reportUnknownPlan(error: ReadError | null): void {
  const now = Date.now();
  if (lastReportedAt !== null && now - lastReportedAt < REPORT_WINDOW_MS) return;
  lastReportedAt = now;
  const code = error?.code || "unknown";
  const message = error?.message ?? "no message";
  console.warn(`[entitlement-read] user_entitlements read failed (${code}): ${message}`);
  Sentry.captureException(new Error(`user_entitlements read failed (${code}): ${message}`), {
    level: "warning",
    tags: { area: "entitlement-read", entitlement_error_code: code },
  });
}

export function resetEntitlementReadReportingForTests(): void {
  lastReportedAt = null;
}

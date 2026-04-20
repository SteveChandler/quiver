import type { SupabaseClient } from "@supabase/supabase-js";
import type { PresetType } from "./types";

export type Tier = "free" | "premium";

export const CAPS = {
  free: { beaches: 1, rulesPerBeach: 3, totalRules: 3 },
  premium: { beaches: 10, rulesPerBeach: 5, totalRules: 50 },
} as const;

const FREE_PRESETS: PresetType[] = ["mellow_session"];

/**
 * Resolves premium vs free for a user.
 *
 * Resolution order (earliest match wins):
 *  1. ALERT_PREVIEW_MODE=true — local dev + preview deployments. Every user
 *     becomes premium. NEVER set this in prod runtime or the free-tier gate
 *     collapses across the entire alerts system.
 *  2. ALERT_BETA_USER_IDS=<uuid>,<uuid>,... — explicit user-id allowlist for
 *     pre-RevenueCat beta testing. Listed users get premium without a
 *     subscription; everyone else still resolves via #3.
 *  3. `user_entitlements` Supabase mirror — source of truth post-paywall.
 *     Refreshed by /api/webhooks/revenuecat from RevenueCat events. Checks
 *     both the is_pro/is_trialing flags AND expires_at as a staleness guard
 *     (if the mirror says "active" but expires_at is in the past, treat as
 *     free until RC reconciliation catches up).
 *
 * Async because #3 is a DB lookup; pass the caller's supabase client so we
 * inherit its auth context (service-role in cron, user-scoped elsewhere).
 */
export async function getUserEntitlement(
  userId: string,
  supabase: SupabaseClient,
): Promise<Tier> {
  if (process.env.ALERT_PREVIEW_MODE === "true") return "premium";

  if (userId && isBetaUser(userId)) return "premium";

  const { data } = await supabase
    .from("user_entitlements")
    .select("is_pro, is_trialing, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  return entitlementFromRow(data);
}

/**
 * Pure helper for callers that already have a user_entitlements row joined
 * in — e.g., alert-evaluate crons selecting `profiles!inner(..., user_entitlements(...))`.
 * Avoids an N+1 query per rule.
 */
export function entitlementFromRow(
  row: {
    is_pro?: boolean | null;
    is_trialing?: boolean | null;
    expires_at?: string | null;
  } | null
  | undefined,
): Tier {
  if (!row) return "free";
  if (!row.is_pro && !row.is_trialing) return "free";
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    // Mirror is stale — RC hasn't delivered the EXPIRATION webhook yet.
    // Treating as free is safer than extending paid access past expiry.
    return "free";
  }
  return "premium";
}

function isBetaUser(userId: string): boolean {
  const raw = process.env.ALERT_BETA_USER_IDS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

interface CanCreateRuleInput {
  tier: Tier;
  homeBeachId: string | null;
  targetBeachId: string;
  existingRuleCount: number;
  existingBeachCount: number;
  isExistingBeach: boolean;
  presetType: PresetType | null;
}

interface CanCreateRuleResult {
  allowed: boolean;
  reason?: string;
}

export function canCreateRule(input: CanCreateRuleInput): CanCreateRuleResult {
  const caps = CAPS[input.tier];

  if (input.tier === "free" && input.targetBeachId !== input.homeBeachId) {
    return { allowed: false, reason: "Free tier: alerts only on home beach. Upgrade for more beaches." };
  }

  if (input.tier === "free" && input.presetType && !FREE_PRESETS.includes(input.presetType)) {
    return { allowed: false, reason: `${input.presetType} is a premium preset. Upgrade to unlock.` };
  }

  // For free tier, beach access is already gated above by the home-beach check.
  // For premium tier, only block when the target is a NEW beach beyond the cap.
  if (input.tier === "premium" && !input.isExistingBeach && input.existingBeachCount >= caps.beaches) {
    return { allowed: false, reason: `Maximum ${caps.beaches} beaches reached.` };
  }

  if (input.existingRuleCount >= caps.totalRules) {
    return { allowed: false, reason: `Maximum ${caps.totalRules} alert rules reached.` };
  }

  return { allowed: true };
}

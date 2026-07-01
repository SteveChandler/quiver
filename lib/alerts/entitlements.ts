import type { SupabaseClient } from "@supabase/supabase-js";
import type { PresetType } from "./types";
import {
  PERSONALIZATION_LOCKED,
  type PersonalizationResultCode,
} from "@/lib/personalization/eligibility";
import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";

export type Tier = "free" | "premium";

export const CAPS = {
  free: { beaches: 1, rulesPerBeach: 3, totalRules: 3 },
  premium: { beaches: 10, rulesPerBeach: 5, totalRules: 50 },
} as const;

export const FREE_GROWTH_WATCHED_LIMIT = 3;

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
  const bypass = envBypassTier(userId);
  if (bypass) return bypass;

  const { data } = await supabase
    .from("user_entitlements")
    .select("is_pro, is_trialing, billing_issue, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  return entitlementFromRow(data);
}

/**
 * Cron-friendly variant: skips the DB round-trip by taking a pre-joined
 * user_entitlements row. Honors the same ALERT_PREVIEW_MODE + beta-user
 * bypasses as getUserEntitlement. Use this when the caller has already
 * selected the row via a join to avoid N+1 queries.
 */
export function resolveEntitlement(
  userId: string,
  row: Parameters<typeof entitlementFromRow>[0],
): Tier {
  const bypass = envBypassTier(userId);
  if (bypass) return bypass;
  return entitlementFromRow(row);
}

/**
 * Returns `"premium"` if an env-var bypass applies, otherwise null. Centralizes
 * the ALERT_PREVIEW_MODE + ALERT_BETA_USER_IDS logic so the sync (resolveEntitlement)
 * and async (getUserEntitlement) entry points share one source of truth.
 */
function envBypassTier(userId: string): Tier | null {
  if (process.env.ALERT_PREVIEW_MODE === "true") return "premium";
  if (userId && isBetaUser(userId)) return "premium";
  return null;
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
    billing_issue?: boolean | null;
    expires_at?: string | null;
  } | null
  | undefined,
): Tier {
  if (!row) return "free";
  if (!row.is_pro && !row.is_trialing) return "free";
  // Staleness guard with billing-issue carve-out: during Apple's ≤60d /
  // Google's ≤30d retry window expires_at can legitimately be in the past
  // while billing_issue=true. The mirror intentionally keeps is_pro=true
  // in that window — downgrading would defeat the grace-period design.
  if (
    row.expires_at &&
    !row.billing_issue &&
    new Date(row.expires_at).getTime() < Date.now()
  ) {
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
  code?: PersonalizationResultCode;
}

export function canCreateRule(input: CanCreateRuleInput): CanCreateRuleResult {
  const caps = CAPS[input.tier];
  const freeGrowthPhaseEnabled = isFreeGrowthPhaseEnabled();
  const ruleCap =
    input.tier === "free" && freeGrowthPhaseEnabled
      ? FREE_GROWTH_WATCHED_LIMIT
      : caps.totalRules;

  if (
    input.tier === "free" &&
    !freeGrowthPhaseEnabled &&
    input.targetBeachId !== input.homeBeachId
  ) {
    return {
      allowed: false,
      code: PERSONALIZATION_LOCKED,
      reason: "Free tier: alerts only on home beach. Upgrade for more beaches.",
    };
  }

  if (input.tier === "free" && input.presetType && !FREE_PRESETS.includes(input.presetType)) {
    return {
      allowed: false,
      code: PERSONALIZATION_LOCKED,
      reason: `${input.presetType} is a premium preset. Upgrade to unlock.`,
    };
  }

  // For free tier, beach access is already gated above by the home-beach check.
  // For premium tier, only block when the target is a NEW beach beyond the cap.
  if (input.tier === "premium" && !input.isExistingBeach && input.existingBeachCount >= caps.beaches) {
    return { allowed: false, reason: `Maximum ${caps.beaches} beaches reached.` };
  }

  if (input.existingRuleCount >= ruleCap) {
    return { allowed: false, reason: `Maximum ${ruleCap} alert rules reached.` };
  }

  return { allowed: true };
}

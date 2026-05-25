import type { SupabaseClient } from "@supabase/supabase-js";

export const PERSONALIZATION_UNLOCKED = "PERSONALIZATION_UNLOCKED";
export const PERSONALIZATION_LOCKED = "PERSONALIZATION_LOCKED";
export const BILLING_ISSUE_LOCKED = "BILLING_ISSUE_LOCKED";
export const ENTITLEMENT_SYNCING = "ENTITLEMENT_SYNCING";
export const BETA_ACCESS_NOT_ENABLED = "BETA_ACCESS_NOT_ENABLED";
export const PERSONALIZATION_DISABLED = "PERSONALIZATION_DISABLED";
export const ALERT_DELIVERY_PAUSED = "ALERT_DELIVERY_PAUSED";

export const PERSONALIZATION_RESULT_CODES = {
  PERSONALIZATION_UNLOCKED,
  PERSONALIZATION_LOCKED,
  BILLING_ISSUE_LOCKED,
  ENTITLEMENT_SYNCING,
  BETA_ACCESS_NOT_ENABLED,
  PERSONALIZATION_DISABLED,
  ALERT_DELIVERY_PAUSED,
} as const;

export type PersonalizationResultCode =
  (typeof PERSONALIZATION_RESULT_CODES)[keyof typeof PERSONALIZATION_RESULT_CODES];

export interface UserEntitlementRow {
  is_pro?: boolean | null;
  is_trialing?: boolean | null;
  billing_issue?: boolean | null;
  expires_at?: string | null;
}

export interface ResolvePersonalizationEligibilityInput {
  userId: string;
  entitlementRow?: UserEntitlementRow | null;
  now?: Date;
  betaAccessRequired?: boolean;
  entitlementSyncing?: boolean;
  personalizationDisabled?: boolean;
  alertDeliveryPaused?: boolean;
}

export interface PersonalizationEligibilityResult {
  code: PersonalizationResultCode;
  canUsePersonalMatch: boolean;
  canUseRankedWindows: boolean;
  canCreatePersonalAlert: boolean;
  canDeliverPersonalAlert: boolean;
  source: "entitlement" | "testflight_bypass" | "none";
}

const LOCKED_FLAGS = {
  canUsePersonalMatch: false,
  canUseRankedWindows: false,
  canCreatePersonalAlert: false,
  canDeliverPersonalAlert: false,
} as const;

const UNLOCKED_FLAGS = {
  canUsePersonalMatch: true,
  canUseRankedWindows: true,
  canCreatePersonalAlert: true,
  canDeliverPersonalAlert: true,
} as const;

function locked(
  code: Exclude<PersonalizationResultCode, typeof PERSONALIZATION_UNLOCKED | typeof ALERT_DELIVERY_PAUSED>,
): PersonalizationEligibilityResult {
  return { code, ...LOCKED_FLAGS, source: "none" };
}

function unlocked(
  source: PersonalizationEligibilityResult["source"],
): PersonalizationEligibilityResult {
  return { code: PERSONALIZATION_UNLOCKED, ...UNLOCKED_FLAGS, source };
}

function isExpired(row: UserEntitlementRow, now: Date): boolean {
  if (!row.expires_at) return false;
  return new Date(row.expires_at).getTime() < now.getTime();
}

function isAllowlistedBetaUser(userId: string): boolean {
  const raw = process.env.PERSONALIZATION_BETA_USER_IDS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(userId);
}

export function resolvePersonalizationEligibility(
  input: ResolvePersonalizationEligibilityInput,
): PersonalizationEligibilityResult {
  if (input.personalizationDisabled) {
    return locked(PERSONALIZATION_DISABLED);
  }

  if (isAllowlistedBetaUser(input.userId)) {
    const betaResult = unlocked("testflight_bypass");
    if (!input.alertDeliveryPaused) return betaResult;
    return {
      ...betaResult,
      code: ALERT_DELIVERY_PAUSED,
      canDeliverPersonalAlert: false,
    };
  }

  if (input.entitlementSyncing) {
    return locked(ENTITLEMENT_SYNCING);
  }

  const row = input.entitlementRow;
  if (!row) {
    return locked(
      input.betaAccessRequired ? BETA_ACCESS_NOT_ENABLED : PERSONALIZATION_LOCKED,
    );
  }

  if (row.billing_issue) {
    return locked(BILLING_ISSUE_LOCKED);
  }

  if (!row.is_pro && !row.is_trialing) {
    return locked(
      input.betaAccessRequired ? BETA_ACCESS_NOT_ENABLED : PERSONALIZATION_LOCKED,
    );
  }

  if (isExpired(row, input.now ?? new Date())) {
    return locked(ENTITLEMENT_SYNCING);
  }

  const result = unlocked("entitlement");
  if (!input.alertDeliveryPaused) return result;
  return {
    ...result,
    code: ALERT_DELIVERY_PAUSED,
    canDeliverPersonalAlert: false,
  };
}

export async function getPersonalizationEligibility(
  userId: string,
  supabase: SupabaseClient,
  options: Omit<
    ResolvePersonalizationEligibilityInput,
    "userId" | "entitlementRow" | "entitlementSyncing"
  > = {},
): Promise<PersonalizationEligibilityResult> {
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("is_pro, is_trialing, billing_issue, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  return resolvePersonalizationEligibility({
    ...options,
    userId,
    entitlementRow: (data as UserEntitlementRow | null) ?? null,
    entitlementSyncing: !!error,
  });
}

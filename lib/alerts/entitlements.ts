import type { PresetType } from "./types";

export type Tier = "free" | "premium";

export const CAPS = {
  free: { beaches: 1, rulesPerBeach: 3, totalRules: 3 },
  premium: { beaches: 10, rulesPerBeach: 5, totalRules: 50 },
} as const;

const FREE_PRESETS: PresetType[] = ["mellow_session"];

export function getUserEntitlement(_userId: string): Tier {
  if (process.env.ALERT_PREVIEW_MODE === "true") return "premium";
  return "free";
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

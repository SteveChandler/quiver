import {
  getSkillLevelOrDefault,
  parseSkillLevel,
} from "@/lib/domains/user-preferences/skill-level";

export const SKILL_AWARE_GO_CHECKS_ENABLED_FLAG = "SKILL_AWARE_GO_CHECKS_ENABLED";
export const SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG = "SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST";

export function isSkillAwareGoChecksEnabled(): boolean {
  return process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG] === "true";
}

function getSkillAwareGoChecksAllowlist(): Set<string> {
  return new Set(
    (process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export function isSkillAwareGoChecksUserAllowed(userId: string): boolean {
  const allowlist = getSkillAwareGoChecksAllowlist();
  return allowlist.size === 0 || allowlist.has(userId);
}

export function isSkillAwareGoChecksOn(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return isSkillAwareGoChecksEnabled() && isSkillAwareGoChecksUserAllowed(userId);
}

// The rating skill defaults a missing or unknown skill to beginner; copy and
// audience fields keep the raw skill.
export function ratingExperience(
  experienceLevel: string | null,
  skillAware: boolean,
): string | null {
  if (!skillAware) return experienceLevel;
  return getSkillLevelOrDefault(parseSkillLevel(experienceLevel));
}

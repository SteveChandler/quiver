export const APPLE_BETA_PROMPT_COOKIE = "quiver_ios_beta_prompt";
export const APPLE_BETA_PROMPT_COOKIE_VALUE = "apple-signin";
export const APPLE_BETA_PROMPT_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export const APPLE_BETA_PROMPT_SOURCE = "apple-signin-beta-prompt";
export const APPLE_BETA_PROMPT_REASON = "apple-signin";
export const APPLE_BETA_PROMPT_PENDING_STORAGE_KEY =
  "quiver_ios_beta_prompt_pending";
export const APPLE_BETA_PROMPT_DISMISSED_STORAGE_KEY =
  "quiver_ios_beta_prompt_dismissed_at";
export const APPLE_BETA_PROMPT_ELIGIBLE_TRACKED_STORAGE_KEY =
  "quiver_ios_beta_prompt_eligible_tracked";

export type AppleBetaPromptDeviceMode = "ios_direct" | "desktop_qr";
export type AppleBetaPromptPlatformGuess =
  | "ios"
  | "ipad"
  | "mac"
  | "desktop"
  | "unknown";

export function getAppleBetaPromptDismissedKey(userId: string): string {
  return `${APPLE_BETA_PROMPT_DISMISSED_STORAGE_KEY}:${userId}`;
}

export function getAppleBetaPromptEligibleTrackedKey(userId: string): string {
  return `${APPLE_BETA_PROMPT_ELIGIBLE_TRACKED_STORAGE_KEY}:${userId}`;
}

export function classifyAppleBetaPromptPlatform(
  userAgent: string,
  maxTouchPoints: number = 0
): AppleBetaPromptPlatformGuess {
  if (/iPhone|iPod/i.test(userAgent)) return "ios";
  if (/iPad/i.test(userAgent)) return "ipad";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ipad";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "mac";
  if (/Windows|Linux|Android/i.test(userAgent)) return "desktop";
  return "unknown";
}

export function getAppleBetaPromptDeviceMode(
  platformGuess: AppleBetaPromptPlatformGuess
): AppleBetaPromptDeviceMode {
  return platformGuess === "ios" || platformGuess === "ipad"
    ? "ios_direct"
    : "desktop_qr";
}

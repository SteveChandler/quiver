export const LEARN_APP_HANDOFF_CTA_ENABLED = "LEARN_APP_HANDOFF_CTA_ENABLED";

/**
 * Swaps the mid-article web signup modal on /learn for the device-aware app
 * handoff. Off by default so the rollback is a flag flip, not a revert.
 */
export function isLearnAppHandoffCtaEnabled(): boolean {
  return process.env[LEARN_APP_HANDOFF_CTA_ENABLED] === "true";
}

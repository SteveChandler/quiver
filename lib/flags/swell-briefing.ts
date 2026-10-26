export const SWELL_BRIEFING_ENABLED_FLAG = "SWELL_BRIEFING_ENABLED";
export const SWELL_BRIEFING_PILOT_USER_FLAG = "SWELL_BRIEFING_PILOT_USER_ID";
export const SWELL_BRIEFING_PUBLISHER_TOKEN_FLAG = "SWELL_BRIEFING_PUBLISHER_TOKEN";
export const SWELL_BRIEFING_REGION_FLAG = "SWELL_BRIEFING_REGION";

/** Minimum length for the scoped publisher token, so a short placeholder cannot be configured. */
const MIN_TOKEN_LENGTH = 32;

export function isSwellBriefingEnabled(): boolean {
  return process.env[SWELL_BRIEFING_ENABLED_FLAG] === "true";
}

/**
 * The single account the pilot publishes for. Everything else about the
 * briefing is scoped to this id, so an unset value disables publication
 * entirely rather than falling back to "any user".
 */
export function getSwellBriefingPilotUserId(): string | null {
  const userId = process.env[SWELL_BRIEFING_PILOT_USER_FLAG]?.trim();
  return userId ? userId : null;
}

/** The region slug the pilot publishes, e.g. `san-diego`. */
export function getSwellBriefingRegion(): string {
  return process.env[SWELL_BRIEFING_REGION_FLAG]?.trim() || "san-diego";
}

/**
 * The scoped publisher credential. Deliberately separate from the service-role
 * key and the admin session: this token may only read an input, publish an
 * edition and read it back for one account. A token shorter than
 * `MIN_TOKEN_LENGTH` is treated as unset so a placeholder never authenticates.
 */
export function getSwellBriefingPublisherToken(): string | null {
  const token = process.env[SWELL_BRIEFING_PUBLISHER_TOKEN_FLAG]?.trim();
  return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

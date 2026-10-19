export const SWELL_OUTLOOK_ENABLED_FLAG = "SWELL_OUTLOOK_ENABLED";
const SWELL_OUTLOOK_TIDE_WINDOW_ENABLED_FLAG = "SWELL_OUTLOOK_TIDE_WINDOW_ENABLED";
export const SWELL_OUTLOOK_USER_ALLOWLIST_FLAG = "SWELL_OUTLOOK_USER_ALLOWLIST";

export function isSwellOutlookEnabled(): boolean {
  return process.env[SWELL_OUTLOOK_ENABLED_FLAG] === "true";
}

export function isSwellOutlookTideWindowEnabled(): boolean {
  return process.env[SWELL_OUTLOOK_TIDE_WINDOW_ENABLED_FLAG] === "true";
}

export function getSwellOutlookAllowlist(): Set<string> {
  return new Set(
    (process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

/** An empty list means nobody: the outlook rolls out by name (like swell follow-ups). */
export function isSwellOutlookUserAllowed(userId: string): boolean {
  return getSwellOutlookAllowlist().has(userId);
}

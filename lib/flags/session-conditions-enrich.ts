export const SESSION_CONDITIONS_ENRICH_ENABLED_FLAG = "SESSION_CONDITIONS_ENRICH_ENABLED";

/** Fill logged sessions' swell, wind and CDIP MOP nearshore conditions every hour. */
export function isSessionConditionsEnrichEnabled(): boolean {
  return process.env[SESSION_CONDITIONS_ENRICH_ENABLED_FLAG] === "true";
}

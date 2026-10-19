const RAIN_ADVISORY_PUSH_ENABLED_FLAG = "RAIN_ADVISORY_PUSH_ENABLED";

export function isRainAdvisoryPushEnabled(): boolean {
  return process.env[RAIN_ADVISORY_PUSH_ENABLED_FLAG] === "true";
}

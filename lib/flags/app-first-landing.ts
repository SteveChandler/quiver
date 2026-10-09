import "server-only";

/** Defaults ON and only tags the analytics cohort; it does not gate whether the
 * field-guide landing renders. Roll back by reverting deploy, not flipping
 * APP_FIRST_LANDING_ENABLED. */
export function isAppFirstLandingEnabled(): boolean {
  return process.env.APP_FIRST_LANDING_ENABLED !== "false";
}

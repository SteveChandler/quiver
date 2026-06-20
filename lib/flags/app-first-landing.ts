import "server-only";

/** Defaults ON and only tags the analytics cohort; it does not gate whether the
 * field-guide landing renders. Roll back by reverting deploy, not flipping
 * APP_FIRST_LANDING_ENABLED. */
export function isAppFirstLandingEnabled(): boolean {
  return process.env.APP_FIRST_LANDING_ENABLED !== "false";
}

/** Cohort tag attached to every app_handoff event so the conversion change is
 * attributable rather than confounded by a sequential before/after. */
export function appFirstCohort(): "app_first" | "control" {
  return isAppFirstLandingEnabled() ? "app_first" : "control";
}

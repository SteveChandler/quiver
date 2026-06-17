import "server-only";

/** App-first landing restructure flag. Default ON; set
 * APP_FIRST_LANDING_ENABLED=false to roll back instantly. */
export function isAppFirstLandingEnabled(): boolean {
  return process.env.APP_FIRST_LANDING_ENABLED !== "false";
}

/** Cohort tag attached to every app_handoff event so the conversion change is
 * attributable rather than confounded by a sequential before/after. */
export function appFirstCohort(): "app_first" | "control" {
  return isAppFirstLandingEnabled() ? "app_first" : "control";
}

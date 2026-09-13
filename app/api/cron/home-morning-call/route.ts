/**
 * GET /api/cron/home-morning-call
 *
 * Morning home-break surf call push. Disabled by default and allowlist-gated
 * for rollout. Auth: Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */

import { runHomeBeachPushCron } from "@/lib/cron/home-beach-push-runner";
import { withObservedCron } from "@/lib/cron/observability";
import { selectAndBuildMorningCall, NOTIFICATION_TYPE, type HomeMorningCallPayload } from "@/lib/notifications/home-morning-call-selection";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[home-morning-call]";
const LOOKAHEAD_HOURS = 30;
const SENTRY_MONITOR = {
  slug: "home-morning-call",
  schedule: "0 13 * * *",
  maxRuntimeMinutes: 5,
};

async function _GET(request: Request): Promise<Response> {
  return runHomeBeachPushCron<HomeMorningCallPayload>(request, {
    contextTag: CONTEXT_TAG,
    enabledEnv: "HOME_MORNING_CALL_ENABLED",
    allowlistEnv: "HOME_MORNING_CALL_TEST_USER_IDS",
    type: NOTIFICATION_TYPE,
    lookaheadHours: LOOKAHEAD_HOURS,
    profileSelectExtraFields: ["experience_level"],
    selectAndBuild: selectAndBuildMorningCall,
    outcome: {
      job: "/api/cron/home-morning-call",
      unit: "calls_sent",
      expectedMin: 1,
      getProduced: (value) => value.sent,
      legitimatelyZero: (value) =>
        value.skipped || value.candidates === 0
          ? {
              reason: value.skipped
                ? "HOME_MORNING_CALL_ENABLED is not true"
                : "No home-beach users had an eligible morning call",
            }
          : undefined,
    },
  });
}

export const GET = withObservedCron(
  "/api/cron/home-morning-call",
  _GET,
  SENTRY_MONITOR,
);

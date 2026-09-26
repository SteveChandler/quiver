import { runSwellEventSnapshotCron } from "@/lib/cron/swell-event-snapshot-runner";
import { withCronOutcome } from "@/lib/cron/outcome";
import { withObservedCron } from "@/lib/cron/observability";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SENTRY_MONITOR = {
  slug: "swell-event-snapshots",
  schedule: "30 14 * * *",
  maxRuntimeMinutes: 5,
};

async function swellEventSnapshotsCron(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse(
      "Unauthorized",
      "Invalid cron authentication",
      401,
    );
  }

  try {
    const summary = await withCronOutcome(
      {
        job: "/api/cron/swell-event-snapshots",
        unit: "snapshots_written",
        expectedMin: 1,
        getProduced: (result) => result.snapshotsWritten,
        legitimatelyZero: (result) =>
          result.beachesEvaluated > 0 && result.eventsDetected === 0 && result.chunksFailed === 0
            ? { reason: "No qualifying swell events in the forecast horizon" }
            : undefined,
      },
      () => runSwellEventSnapshotCron({ now: new Date() }),
    );
    return createSuccessResponse(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron(
  "/api/cron/swell-event-snapshots",
  swellEventSnapshotsCron,
  SENTRY_MONITOR,
);

import {
  createErrorResponse,
  createSuccessResponse,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse(
      "Unauthorized",
      "Invalid cron authentication",
      401,
    );
  }

  return createSuccessResponse(
    await withCronOutcome(
      {
        job: "/api/cron/reengagement-email",
        unit: "emails_sent",
        expectedMin: 1,
        getProduced: (value) => value.summary.sent,
        legitimatelyZero: () => ({ reason: "Legacy re-engagement recommendations are intentionally retired" }),
      },
      async () => ({
        retired: true,
        message:
          "Legacy condition-based re-engagement recommendations are retired until they are backed by a canonical session decision.",
        summary: {
          candidates: 0,
          sent: 0,
          skipped: { retired: 1 },
        },
      }),
    ),
  );
}

export const GET = withObservedCron("/api/cron/reengagement-email", _GET);

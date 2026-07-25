import {
  createErrorResponse,
  createSuccessResponse,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPLACEMENT_PATH = "/api/cron/condition-alert-deliver";

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse(
      "Unauthorized",
      "Invalid cron authentication",
      401,
    );
  }

  return createSuccessResponse({
    retired: true,
    replacement: REPLACEMENT_PATH,
    message:
      "Legacy conditions-alert email decisions are retired; canonical condition-alert delivery owns forecast recommendation email.",
    summary: {
      candidates: 0,
      sent: 0,
      skipped: { retired: 1 },
    },
  });
}

export const GET = withObservedCron("/api/cron/conditions-alert-email", _GET);

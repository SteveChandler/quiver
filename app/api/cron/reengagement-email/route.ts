import {
  createErrorResponse,
  createSuccessResponse,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";

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

  return createSuccessResponse({
    retired: true,
    message:
      "Legacy condition-based re-engagement recommendations are retired until they are backed by a canonical session decision.",
    summary: {
      candidates: 0,
      sent: 0,
      skipped: { retired: 1 },
    },
  });
}

export const GET = withObservedCron("/api/cron/reengagement-email", _GET);

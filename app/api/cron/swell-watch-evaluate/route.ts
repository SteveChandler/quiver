import { z } from "zod";
import { withObservedCron } from "@/lib/cron/observability";
import { createErrorResponse, createSuccessResponse, validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { acquisitionConfig } from "@/lib/alerts/swell-watch/acquisition";
import { verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import { loadSwellWatchAcquisitionScope } from "@/lib/alerts/swell-watch/provider-run-store";
import { evaluateSwellWatchShadow } from "@/lib/alerts/swell-watch/shadow-evaluation";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const configuration = acquisitionConfig.extend({
  cohort: acquisitionConfig.shape.cohort.max(10),
  policy: z.custom<SwellWatchPolicy>((value) => verifySwellWatchPolicy(value)
    && value.schema_version === "swell-watch-policy.v2"),
});

async function evaluate(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
  if (process.env.SWELL_WATCH_SHADOW_EVALUATION_ENABLED !== "true") {
    return createSuccessResponse({ skipped: true, reason: "disabled", enqueued: 0 });
  }
  let operation: { provider_batch_id: string };
  try {
    if (new URL(request.url).search) throw new Error("Unexpected query");
    operation = z.object({ provider_batch_id: z.uuid() }).strict().parse(await request.json());
  } catch {
    return createErrorResponse("Invalid request", "Expected only a completed provider batch ID", 400);
  }
  let config: z.infer<typeof configuration>;
  try {
    config = configuration.parse(JSON.parse(process.env.SWELL_WATCH_PRODUCER_CONFIG ?? "null"));
  } catch {
    return createErrorResponse("Evaluator unavailable", "Valid server-side evaluation configuration is required", 503);
  }
  try {
    const client = createSupabaseServiceRoleClient();
    const scopes = await loadSwellWatchAcquisitionScope(config.cohort, client);
    const result = await evaluateSwellWatchShadow({ providerBatchId: operation.provider_batch_id,
      forecastDays: 7, now: new Date().toISOString(), policy: config.policy, scopes },
    client as unknown as Parameters<typeof evaluateSwellWatchShadow>[1]);
    return createSuccessResponse(result);
  } catch {
    console.error("[swell-watch-evaluate] shadow evaluation failed");
    return createErrorResponse("Evaluator failed", "Completed-run shadow evaluation failed", 500);
  }
}

export const POST = withObservedCron("/api/cron/swell-watch-evaluate", async (request: Request): Promise<Response> => {
  const response = await evaluate(request);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
});

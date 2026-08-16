import { z } from "zod";

import { withCronOutcome } from "@/lib/cron/outcome";
import { withObservedCron } from "@/lib/cron/observability";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/cron/major-event-hold-retention";

const purgeResultSchema = z
  .array(
    z
      .object({
        chains_deleted: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER),
        rows_deleted: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER),
      })
      .strict(),
  )
  .length(1);

type PurgeRpcResponse = { data: unknown; error: unknown };

interface RetentionDatabaseClient {
  rpc: (
    name: "purge_expired_regional_recommendation_holds_v1",
  ) => PromiseLike<PurgeRpcResponse>;
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
    },
  });
}

async function runRetention(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return jsonResponse(
      { ok: false, status: "unauthorized", errorCode: "unauthorized" },
      401,
    );
  }

  let result: PurgeRpcResponse;
  try {
    const client =
      createSupabaseServiceRoleClient() as unknown as RetentionDatabaseClient;
    result = await client.rpc.call(
      client,
      "purge_expired_regional_recommendation_holds_v1",
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        status: "error",
        errorCode: "purge_failed",
        counts: { chainsDeleted: 0, rowsDeleted: 0 },
      },
      500,
    );
  }

  if (result.error) {
    return jsonResponse(
      {
        ok: false,
        status: "error",
        errorCode: "purge_failed",
        counts: { chainsDeleted: 0, rowsDeleted: 0 },
      },
      500,
    );
  }

  const parsed = purgeResultSchema.safeParse(result.data);
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        status: "error",
        errorCode: "purge_result_invalid",
        counts: { chainsDeleted: 0, rowsDeleted: 0 },
      },
      500,
    );
  }

  const [counts] = parsed.data;
  const outcome = await withCronOutcome(
    {
      job: ROUTE,
      unit: "rows_deleted",
      expectedMin: 1,
      getProduced: (value) => value.rowsDeleted,
      legitimatelyZero: (value) =>
        value.rowsDeleted === 0
          ? { reason: "No expired regional recommendation hold rows were present" }
          : undefined,
    },
    async () => ({
      chainsDeleted: counts.chains_deleted,
      rowsDeleted: counts.rows_deleted,
    }),
  );

  return jsonResponse({
    ok: true,
    status: "completed",
    counts: {
      chainsDeleted: outcome.chainsDeleted,
      rowsDeleted: outcome.rowsDeleted,
    },
  });
}

export const GET = withObservedCron(ROUTE, runRetention, {
  slug: "major-event-hold-retention",
  schedule: "15 9 * * 0",
});

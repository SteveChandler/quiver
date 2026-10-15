import { NextResponse } from "next/server";

import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAwcMetars, runRainfallRunoffIngest } from "@/lib/services/water-quality/rainfall-runoff-ingest";
import { RAINFALL_READINGS_TABLE } from "@/lib/services/water-quality/rainfall-runoff-read";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 11 sequential AWC requests, 10 s timeout, one retry each

const ROUTE = "/api/cron/rainfall-runoff";
const SCHEDULE = "0 */3 * * *";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServiceRoleClient();
    const result = await withCronOutcome(
      {
        job: ROUTE,
        unit: "rainfall_readings_written",
        expectedMin: 1,
        getProduced: (value) => value.written,
      },
      () => runRainfallRunoffIngest({
        fetchMetars: fetchAwcMetars,
        writeReadings: async (readings) => {
          const { error } = await supabase.from(RAINFALL_READINGS_TABLE as never)
            .upsert(readings as never, { onConflict: "cluster_id,window_end" });
          if (error) throw new Error(`rainfall_runoff_readings upsert failed: ${error.message}`);
          // Only the latest few hours are ever read; keep a week for spot checks.
          const { error: pruneError } = await supabase.from(RAINFALL_READINGS_TABLE as never).delete()
            .lt("window_end", new Date(Date.now() - RETENTION_MS).toISOString());
          if (pruneError) console.warn("[rainfall-runoff] retention prune failed", pruneError.message);
        },
      }),
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[rainfall-runoff] cron failed", error);
    return NextResponse.json(
      { success: false, error: "Rainfall runoff ingest failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export const GET = withObservedCron(ROUTE, _GET, {
  slug: "rainfall-runoff",
  schedule: SCHEDULE,
  maxRuntimeMinutes: 5,
});

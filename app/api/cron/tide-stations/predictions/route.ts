import { setTimeout as sleep } from "node:timers/promises";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronOutcome } from "@/lib/cron/outcome";
import { withObservedCron } from "@/lib/cron/observability";
import { createErrorResponse, createSuccessResponse, validateCronRequest } from "@/lib/middleware/api-wrappers";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";
import { NoaaTideRequestError } from "@/lib/services/noaa-coops/datagetter";
import { fetchHighLowTidePredictions, fetchHourlyTidePredictions } from "@/lib/services/noaa-tide-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TideStationPredictionRow } from "@/lib/tide-stations/types";

export const maxDuration = 120;

const JOB = "/api/cron/tide-stations/predictions";
const DAY_MS = 86_400_000;
const DEADLINE_MS = 90_000;
const PAUSE_MS = 250;
const BATCH_SIZE = 2;

interface Candidate {
  id: string;
  source_station_id: string;
  station_kind: "reference" | "subordinate";
  coverage_end: string | null;
}

interface Summary {
  stationsAttempted: number;
  stationsWritten: number;
  rowsUpserted: number;
  rowsDeleted: number;
  upstreamSkipped: Record<string, number>;
  stoppedReason: "upstream_unavailable" | "deadline_exceeded" | null;
  outcome: "ok" | "degraded";
}

type FetchResult =
  | { station: Candidate; rows: TideStationPredictionRow[] }
  | { station: Candidate; reason: string; cooldown: boolean };

async function fetchStation(station: Candidate, startIso: string, endIso: string): Promise<FetchResult> {
  const [extremes, hourly] = await Promise.allSettled([
    fetchHighLowTidePredictions(station.source_station_id, startIso, endIso, { raw: true }),
    station.station_kind === "reference"
      ? fetchHourlyTidePredictions(station.source_station_id, startIso, endIso, { raw: true })
      : Promise.resolve([]),
  ]);
  for (const result of [extremes, hourly]) {
    if (result.status === "rejected" && !(result.reason instanceof NoaaTideRequestError)) throw result.reason;
  }
  const upstreamError = [extremes, hourly].find((result) => result.status === "rejected");
  if (upstreamError?.status === "rejected") {
    const error = upstreamError.reason as NoaaTideRequestError;
    const cooldown = error.status === 403 || error.status === 429 || /cooling down/i.test(error.message);
    return { station, reason: cooldown ? "noaa-cooldown" : "noaa-request", cooldown };
  }
  if (extremes.status !== "fulfilled" || hourly.status !== "fulfilled") {
    throw new Error("Unexpected NOAA prediction result");
  }
  if (!extremes.value.length) return { station, reason: "noaa-empty", cooldown: false };
  const rows: TideStationPredictionRow[] = [
    ...extremes.value.map((point) => ({
      station_id: station.id, kind: point.type, ts: point.ts, height_m: point.tide_height_m,
    })),
    ...hourly.value.map((point) => ({
      station_id: station.id, kind: "hourly" as const, ts: point.ts, height_m: point.tide_height_m,
    })),
  ];
  return { station, rows };
}

async function ingest(db: SupabaseClient, maxStations: number): Promise<Summary> {
  const startedAt = Date.now();
  const now = new Date(startedAt);
  const startIso = new Date(startedAt - DAY_MS).toISOString();
  const endIso = new Date(startedAt + 45 * DAY_MS).toISOString();
  const cutoff = new Date(startedAt - 3 * DAY_MS).toISOString();
  const refreshBefore = new Date(startedAt + 20 * DAY_MS).toISOString();
  const { data, error } = await db.from("tide_station_prediction_coverage")
    .select("id, source_station_id, station_kind, coverage_end")
    .or(`coverage_end.is.null,coverage_end.lt.${refreshBefore}`)
    .order("coverage_end", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true })
    .limit(maxStations);
  if (error) throw new Error(`Failed to select tide stations: ${error.message}`);
  const candidates = (data ?? []) as Candidate[];
  const summary: Summary = {
    stationsAttempted: 0, stationsWritten: 0, rowsUpserted: 0, rowsDeleted: 0,
    upstreamSkipped: {}, stoppedReason: null, outcome: "ok",
  };
  let consecutiveUpstreamFailures = 0;

  for (let index = 0; index < candidates.length;) {
    if (Date.now() - startedAt >= DEADLINE_MS) {
      summary.stoppedReason = "deadline_exceeded";
      break;
    }
    const batch = candidates.slice(index, index + Math.min(BATCH_SIZE, 3 - consecutiveUpstreamFailures));
    summary.stationsAttempted += batch.length;
    const results = await Promise.all(batch.map((station) => fetchStation(station, startIso, endIso)));
    for (const result of results) {
      if ("reason" in result) {
        summary.upstreamSkipped[result.reason] = (summary.upstreamSkipped[result.reason] ?? 0) + 1;
        if (summary.stoppedReason) continue;
        consecutiveUpstreamFailures = result.reason === "noaa-empty" ? 0 : consecutiveUpstreamFailures + 1;
        if (result.cooldown || consecutiveUpstreamFailures >= 3) {
          summary.stoppedReason = "upstream_unavailable";
          continue;
        }
        continue;
      }
      if (summary.stoppedReason) continue;
      consecutiveUpstreamFailures = 0;
      for (let offset = 0; offset < result.rows.length; offset += 1000) {
        const { error: writeError } = await db.from("tide_station_predictions")
          .upsert(result.rows.slice(offset, offset + 1000), { onConflict: "station_id,ts,kind" });
        if (writeError) throw new Error(`Failed to upsert ${result.station.id}: ${writeError.message}`);
        summary.rowsUpserted += Math.min(1000, result.rows.length - offset);
      }
      const { count, error: deleteError } = await db.from("tide_station_predictions")
        .delete({ count: "exact" }).eq("station_id", result.station.id).lt("ts", cutoff);
      if (deleteError) throw new Error(`Failed to prune ${result.station.id}: ${deleteError.message}`);
      summary.rowsDeleted += count ?? 0;
      summary.stationsWritten++;
    }
    if (summary.stoppedReason) break;
    index += batch.length;
    if (index < candidates.length) await sleep(PAUSE_MS);
  }
  if (summary.stoppedReason || Object.keys(summary.upstreamSkipped).length) summary.outcome = "degraded";
  console.log("Tide station predictions ingest", { ...summary, at: now.toISOString() });
  return summary;
}

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return createErrorResponse("Unauthorized", null, 401);
  const rawMax = new URL(request.url).searchParams.get("maxStations");
  const maxStations = rawMax === null ? 120 : Number(rawMax);
  if (!Number.isInteger(maxStations) || maxStations < 1 || maxStations > 120) {
    return createErrorResponse("maxStations must be an integer from 1 to 120", null, 400);
  }
  const db = createSupabaseServiceRoleClient() as unknown as SupabaseClient;
  const summary = await withCronOutcome({
    job: JOB,
    unit: "stations_written",
    expectedMin: 0,
    getProduced: (result: Summary) => result.stationsWritten,
  }, () => ingest(db, maxStations));
  return createSuccessResponse(summary);
}

const handleGet = withObservedCron(JOB, _GET);
export const GET = withErrorNoStore(handleGet, "/api/cron/tide-stations/predictions");

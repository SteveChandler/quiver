import { setTimeout as sleep } from "node:timers/promises";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronOutcome } from "@/lib/cron/outcome";
import { withObservedCron } from "@/lib/cron/observability";
import { createErrorResponse, createSuccessResponse, validateCronRequest } from "@/lib/middleware/api-wrappers";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";
import { NoaaTideRequestError } from "@/lib/services/noaa-coops/datagetter";
import { fetchHighLowTidePredictions, fetchHourlyTidePredictions } from "@/lib/services/noaa-tide-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { storedStationSeriesWindow } from "@/lib/tide-stations/predictions";
import type { TideStationPredictionRow } from "@/lib/tide-stations/types";

export const maxDuration = 120;

const JOB = "/api/cron/tide-stations/predictions";
const DAY_MS = 86_400_000;
const DEADLINE_MS = 75_000;
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
  coverageGap: { count: number; earliestCoverageEnd: string | null };
}

interface StationAttempt {
  station_id: string;
  attempted_at: string;
  outcome: string;
}

interface StationFetch {
  station: Candidate;
  attemptedAt: string;
  result: PromiseSettledResult<FetchResult>;
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
  const upstreamErrors = [extremes, hourly].flatMap((result) =>
    result.status === "rejected" ? [result.reason as NoaaTideRequestError] : []);
  if (upstreamErrors.length) {
    const cooldown = upstreamErrors.some((error) =>
      error.status === 403 || error.status === 429 || /cooling down/i.test(error.message));
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

async function readCoverageGap(db: SupabaseClient): Promise<Summary["coverageGap"]> {
  const { data, count, error } = await db.from("tide_station_prediction_coverage")
    .select("coverage_end", { count: "exact" })
    .not("coverage_end", "is", null)
    .lt("coverage_end", new Date(Date.now() + 7 * DAY_MS).toISOString())
    .order("coverage_end", { ascending: true })
    .limit(1);
  if (error) throw new Error(`Failed to check tide coverage: ${error.message}`);
  const earliest = (data as Array<{ coverage_end: string }> | null)?.[0];
  return { count: count ?? 0, earliestCoverageEnd: earliest?.coverage_end ?? null };
}

async function ingest(db: SupabaseClient, maxStations: number): Promise<Summary> {
  const startedAt = Date.now();
  const now = new Date(startedAt);
  const startIso = storedStationSeriesWindow(startedAt).start.toISOString();
  const endIso = new Date(startedAt + 45 * DAY_MS).toISOString();
  const dayStartMs = Math.floor(startedAt / DAY_MS) * DAY_MS;
  const cutoff = new Date(dayStartMs - 3 * DAY_MS).toISOString();
  const refreshBefore = new Date(startedAt + 20 * DAY_MS).toISOString();
  const retryBefore = new Date(startedAt - DAY_MS).toISOString();
  const { data, error } = await db.from("tide_station_prediction_coverage")
    .select("id, source_station_id, station_kind, coverage_end")
    .or(`coverage_end.is.null,coverage_end.lt.${refreshBefore}`)
    .or(`attempted_at.is.null,outcome.eq.written,attempted_at.lte.${retryBefore}`)
    .order("never_attempted", { ascending: false })
    .order("coverage_end", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true })
    .limit(maxStations);
  if (error) throw new Error(`Failed to select tide stations: ${error.message}`);
  const candidates = (data ?? []) as Candidate[];
  const summary: Summary = {
    stationsAttempted: 0, stationsWritten: 0, rowsUpserted: 0, rowsDeleted: 0,
    upstreamSkipped: {}, stoppedReason: null, outcome: "ok",
    coverageGap: { count: 0, earliestCoverageEnd: null },
  };
  let consecutiveUpstreamFailures = 0;

  for (let index = 0; index < candidates.length;) {
    if (Date.now() - startedAt >= DEADLINE_MS) {
      summary.stoppedReason = "deadline_exceeded";
      break;
    }
    const batch = candidates.slice(index, index + Math.min(BATCH_SIZE, 3 - consecutiveUpstreamFailures));
    const results = await Promise.all(batch.map(async (station): Promise<StationFetch | null> => {
      if (Date.now() - startedAt >= DEADLINE_MS) {
        summary.stoppedReason = "deadline_exceeded";
        return null;
      }
      const attemptedAt = new Date(Date.now()).toISOString();
      summary.stationsAttempted++;
      try {
        return { station, attemptedAt, result: { status: "fulfilled", value: await fetchStation(station, startIso, endIso) } };
      } catch (reason) {
        return { station, attemptedAt, result: { status: "rejected", reason } };
      }
    }));
    const attempts: StationAttempt[] = [];
    const errors: unknown[] = [];
    for (const fetched of results) {
      if (!fetched) continue;
      const { station, attemptedAt, result } = fetched;
      const attempt: StationAttempt = { station_id: station.id, attempted_at: attemptedAt, outcome: "error" };
      attempts.push(attempt);
      if (result.status === "rejected") {
        errors.push(result.reason);
        continue;
      }
      const value = result.value;
      if ("reason" in value) {
        summary.upstreamSkipped[value.reason] = (summary.upstreamSkipped[value.reason] ?? 0) + 1;
        attempt.outcome = value.reason;
        continue;
      }
      if (Date.now() - startedAt >= DEADLINE_MS) {
        summary.stoppedReason = "deadline_exceeded";
        attempt.outcome = "deadline_exceeded";
        continue;
      }
      try {
        for (let offset = 0; offset < value.rows.length; offset += 1000) {
          const { error: writeError } = await db.from("tide_station_predictions")
            .upsert(value.rows.slice(offset, offset + 1000), { onConflict: "station_id,ts,kind" });
          if (writeError) throw new Error(`Failed to upsert ${station.id}: ${writeError.message}`);
          summary.rowsUpserted += Math.min(1000, value.rows.length - offset);
        }
        const { count, error: deleteError } = await db.from("tide_station_predictions")
          .delete({ count: "exact" }).eq("station_id", station.id).lt("ts", cutoff);
        if (deleteError) throw new Error(`Failed to prune ${station.id}: ${deleteError.message}`);
        summary.rowsDeleted += count ?? 0;
        summary.stationsWritten++;
        attempt.outcome = "written";
      } catch (error) {
        errors.push(error);
      }
    }
    if (attempts.length) {
      const { error: attemptError } = await db.from("tide_station_prediction_attempts")
        .upsert(attempts, { onConflict: "station_id" });
      if (attemptError) throw new Error(`Failed to record tide attempts: ${attemptError.message}`);
    }
    if (errors.length) throw errors[0];
    // Preserve every usable batch result before applying an upstream stop.
    for (const fetched of results) {
      if (!fetched || fetched.result.status !== "fulfilled") continue;
      const result = fetched.result.value;
      if ("reason" in result) {
        consecutiveUpstreamFailures = result.reason === "noaa-empty" ? 0 : consecutiveUpstreamFailures + 1;
        if (result.cooldown || consecutiveUpstreamFailures >= 3) {
          summary.stoppedReason ??= "upstream_unavailable";
          break;
        }
      } else {
        consecutiveUpstreamFailures = 0;
      }
    }
    if (summary.stoppedReason) break;
    index += batch.length;
    if (index < candidates.length) await sleep(PAUSE_MS);
  }
  summary.coverageGap = await readCoverageGap(db);
  if (summary.stoppedReason || Object.keys(summary.upstreamSkipped).length || summary.coverageGap.count) summary.outcome = "degraded";
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
    failureReason: (result) => result.coverageGap.count > 0
      ? `${result.coverageGap.count} active NOAA stations have stored tide coverage below 7 days; earliest coverage_end=${result.coverageGap.earliestCoverageEnd}`
      : null,
  }, () => ingest(db, maxStations));
  return createSuccessResponse(summary);
}

const handleGet = withObservedCron(JOB, _GET);
export const GET = withErrorNoStore(handleGet, "/api/cron/tide-stations/predictions");

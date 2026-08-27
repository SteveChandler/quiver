import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withRateLimit,
  createErrorResponse,
  createSuccessResponse,
  validateOrError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { updateBeachForecast } from "@/lib/utils/forecast-server-utils";
import { readLatestForecastMetadata } from "@/lib/utils/forecast-service-utils";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const QuerySchema = z.object({
  beachId: z.string().uuid({ message: "beachId must be a valid UUID" }),
  refresh: z.enum(["if-stale"]).optional(),
  includeStale: z.enum(["1"]).optional(),
});

type CurrentForecastRow = EnhancedForecastEntity & {
  source_fetched_at: string | null;
  station_id: string | null;
  updated_at?: string | null;
  tide_height?: string | null;
  tide_status?: string | null;
};

type CurrentMetadata = {
  refreshed: boolean;
  refreshAttempted: boolean;
  stale: boolean;
  missing: boolean;
  /**
   * Authoritative freshness state. Prefer this over `stale`/`missing`.
   *
   * fresh       — usable data within the staleness threshold
   * stale       — usable data past the threshold. Render it WITH `lastUpdated`.
   * unavailable — no usable data. Render an explicit empty state.
   *
   * `missing` is retained for pre-adoption native builds and currently also
   * returns true for `stale`. It is corrected in a later phase.
   */
  availability: "fresh" | "stale" | "unavailable";
  dataSource: string | null;
  lastUpdated: string | null;
  reason: string | null;
  refreshError?: string;
};

function formatTideHeight(value: unknown): string | null {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `${numeric.toFixed(1)} ft`;
}

async function readBeachExists(
  supabase: AuthenticatedContext["supabase"],
  beachId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("beaches")
    .select("id")
    .eq("id", beachId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function readLatestHourlyTide(
  supabase: AuthenticatedContext["supabase"],
  beachId: string,
  now: Date,
): Promise<string | null> {
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("tide_ft")
    .eq("beach_id", beachId)
    .lte("ts", now.toISOString())
    .gte("ts", twoHoursAgo.toISOString())
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return formatTideHeight(data?.tide_ft);
}

async function readCurrentRow(
  supabase: AuthenticatedContext["supabase"],
  beachId: string,
  now: Date,
): Promise<CurrentForecastRow | null> {
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .lte("forecast_at", now.toISOString())
    .order("forecast_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [displayRow] = await applyV51DisplayOverrideToForecasts([
    data as unknown as EnhancedForecastEntity,
  ]);
  const syncedTideHeight = await readLatestHourlyTide(supabase, beachId, now);
  const sourceFetchedAt =
    displayRow.data_source === "CDIP"
      ? displayRow.raw_forecast?.fetch_timestamps?.cdip
      : displayRow.data_source === "NOAA_NWS"
        ? displayRow.raw_forecast?.fetch_timestamps?.noaa
        : null;
  const currentRow: CurrentForecastRow = {
    ...displayRow,
    source_fetched_at:
      sourceFetchedAt ?? displayRow.om_fetched_at ?? displayRow.updated_at ?? null,
    station_id:
      displayRow.raw_forecast?.wave_height_provenance?.station_id ?? null,
  };
  return syncedTideHeight
    ? { ...currentRow, tide_height: syncedTideHeight }
    : currentRow;
}

function buildMetadata(args: {
  refreshed: boolean;
  refreshAttempted: boolean;
  current: CurrentForecastRow | null;
  freshness: Awaited<ReturnType<typeof readLatestForecastMetadata>>;
  refreshError?: string;
}): CurrentMetadata {
  const unavailable = args.current == null || args.freshness.missing || args.freshness.stale;
  const availability =
    args.current == null || args.freshness.missing
      ? "unavailable"
      : args.freshness.stale
        ? "stale"
        : "fresh";
  return {
    refreshed: args.refreshed,
    refreshAttempted: args.refreshAttempted,
    stale: args.freshness.stale,
    missing: unavailable,
    availability,
    dataSource: args.freshness.dataSource,
    lastUpdated: args.freshness.lastUpdated,
    reason: unavailable
      ? args.refreshError ?? args.freshness.reason ?? "Current conditions unavailable"
      : null,
    ...(args.refreshError ? { refreshError: args.refreshError } : {}),
  };
}

async function currentForecastHandler(
  request: NextRequest,
  { supabase }: AuthenticatedContext,
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const validation = validateOrError(QuerySchema, {
    beachId: searchParams.get("beachId") ?? undefined,
    refresh: searchParams.get("refresh") ?? undefined,
    includeStale: searchParams.get("includeStale") ?? undefined,
  });
  if ("error" in validation) return validation.error;

  const { beachId, refresh, includeStale } = validation.data;
  const beachExists = await readBeachExists(supabase, beachId);
  if (!beachExists) {
    return createErrorResponse("Beach not found", null, 404);
  }

  const now = new Date();
  let current = await readCurrentRow(supabase, beachId, now);
  let freshness = await readLatestForecastMetadata(supabase, beachId);
  const shouldRefresh = refresh === "if-stale" && (current == null || freshness.missing || freshness.stale);
  let refreshed = false;
  let refreshError: string | undefined;

  if (shouldRefresh) {
    try {
      await updateBeachForecast(beachId);
      refreshed = true;
      current = await readCurrentRow(supabase, beachId, new Date());
      freshness = await readLatestForecastMetadata(supabase, beachId);
    } catch (error) {
      refreshError = error instanceof Error ? error.message : "Current conditions refresh failed";
      current = null;
    }
  }

  const metadata = buildMetadata({
    refreshed,
    refreshAttempted: shouldRefresh,
    current,
    freshness,
    refreshError,
  });
  const shouldIncludeCurrent =
    includeStale === "1"
      ? metadata.availability !== "unavailable"
      : !metadata.missing && !metadata.stale;
  const currentForDisplay = shouldIncludeCurrent ? current : null;
  const response = createSuccessResponse({
    current: currentForDisplay,
    metadata,
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = withRateLimit(
  withAuth(currentForecastHandler, { errorMessage: "Failed to load current conditions" }),
  "surf-discovery",
);

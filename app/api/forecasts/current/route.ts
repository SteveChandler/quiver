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
import { getStalenessDetails } from "@/lib/utils/forecast-service-utils";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const QuerySchema = z.object({
  beachId: z.string().uuid({ message: "beachId must be a valid UUID" }),
  refresh: z.enum(["if-stale"]).optional(),
});

type CurrentForecastRow = EnhancedForecastEntity & {
  updated_at?: string | null;
  tide_height?: string | null;
  tide_status?: string | null;
};

type CurrentMetadata = {
  refreshed: boolean;
  refreshAttempted: boolean;
  stale: boolean;
  missing: boolean;
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

async function readLatestMetadata(
  supabase: AuthenticatedContext["supabase"],
  beachId: string,
): Promise<{
  stale: boolean;
  missing: boolean;
  dataSource: string | null;
  lastUpdated: string | null;
  reason: string | null;
}> {
  const { data, error } = await supabase
    .from("v_enhanced_forecast_latest")
    .select("updated_at, data_source")
    .eq("beach_id", beachId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.updated_at) {
    return {
      stale: false,
      missing: true,
      dataSource: null,
      lastUpdated: null,
      reason: "No forecast data in cache",
    };
  }

  const dataSource = data.data_source ?? null;
  const details = getStalenessDetails(data.updated_at, dataSource);
  return {
    stale: details.isStale,
    missing: false,
    dataSource,
    lastUpdated: data.updated_at,
    reason: details.isStale
      ? `Data is ${details.hoursSinceUpdate.toFixed(1)}h old (threshold: ${details.threshold}h)`
      : null,
  };
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
  return syncedTideHeight
    ? ({ ...displayRow, tide_height: syncedTideHeight } as CurrentForecastRow)
    : (displayRow as CurrentForecastRow);
}

function buildMetadata(args: {
  refreshed: boolean;
  refreshAttempted: boolean;
  current: CurrentForecastRow | null;
  freshness: Awaited<ReturnType<typeof readLatestMetadata>>;
  refreshError?: string;
}): CurrentMetadata {
  const unavailable = args.current == null || args.freshness.missing || args.freshness.stale;
  return {
    refreshed: args.refreshed,
    refreshAttempted: args.refreshAttempted,
    stale: args.freshness.stale,
    missing: unavailable,
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
  });
  if ("error" in validation) return validation.error;

  const { beachId, refresh } = validation.data;
  const beachExists = await readBeachExists(supabase, beachId);
  if (!beachExists) {
    return createErrorResponse("Beach not found", null, 404);
  }

  const now = new Date();
  let current = await readCurrentRow(supabase, beachId, now);
  let freshness = await readLatestMetadata(supabase, beachId);
  const shouldRefresh = refresh === "if-stale" && (current == null || freshness.missing || freshness.stale);
  let refreshed = false;
  let refreshError: string | undefined;

  if (shouldRefresh) {
    try {
      await updateBeachForecast(beachId);
      refreshed = true;
      current = await readCurrentRow(supabase, beachId, new Date());
      freshness = await readLatestMetadata(supabase, beachId);
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
  const currentForDisplay = metadata.missing || metadata.stale ? null : current;
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

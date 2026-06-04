"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// ============================================================================
// Types
// ============================================================================

export interface OverallAccuracyStats {
  avgRawMae: number;
  avgCorrectedMae: number;
  avgImprovementPct: number;
  beachCount: number;
  totalPredictions: number;
}

export interface RegionalAccuracyRow {
  state: string;
  avgRawMae: number;
  avgCorrectedMae: number;
  avgImprovementPct: number;
  beachCount: number;
}

export interface DailyAccuracyPoint {
  date: string;
  rawMae: number;
  correctedMae: number;
  count: number;
}

export interface TopBeachRow {
  beachId: string;
  beachName: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  rawMae: number;
  correctedMae: number;
  maeImprovementPct: number;
  predictionsMatched: number;
}

export type ForecastAccuracyReportStatus = "live" | "building";
export type ForecastAccuracyConfidenceLevel = "high" | "medium" | "low";

export interface ForecastAccuracyConfidence {
  level: ForecastAccuracyConfidenceLevel;
  label: string;
  score: number;
  sources: string[];
  reason: string;
}

export interface ForecastAccuracyBeachRow {
  id: string;
  beachId: string;
  beachName: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  noaaBaselineMae: number;
  quiverMae: number;
  improvementPct: number;
  validatedPairCount: number;
  lastUpdated: string | null;
  confidence: ForecastAccuracyConfidence;
  canClaimImprovement: boolean;
}

export interface ForecastAccuracyBuildingRow {
  id: string;
  label: string;
  status: string;
  detail: string;
  confidenceLabel: string;
}

export interface ForecastAccuracySummary {
  status: ForecastAccuracyReportStatus;
  beachCount: number;
  totalPredictions: number;
  validatedPairCount: number;
  noaaBaselineMae: number | null;
  quiverMae: number | null;
  improvementPct: number | null;
  lastUpdated: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  confidence: ForecastAccuracyConfidence;
  canClaimImprovement: boolean;
}

export interface ForecastAccuracyReport {
  generatedAt: string;
  summary: ForecastAccuracySummary;
  beachRows: ForecastAccuracyBeachRow[];
  buildingRows: ForecastAccuracyBuildingRow[];
  dailyTimeSeries: DailyAccuracyPoint[];
  regionalData: RegionalAccuracyRow[];
}

// ============================================================================
// Helpers
// ============================================================================

interface MatviewRow {
  beach_id: string;
  beach_name: string;
  predictions_total: number;
  predictions_matched: number;
  match_rate_pct: number;
  raw_mae: number;
  corrected_mae: number;
  mae_improvement_pct: number;
  improvement_rate_pct: number;
  avg_raw_bias: number;
  avg_corrected_bias: number;
  last_prediction_at: string | null;
  period_start: string | null;
  period_end: string | null;
}

type AccuracyReportMatviewRow = Pick<
  MatviewRow,
  | "beach_id"
  | "beach_name"
  | "predictions_total"
  | "predictions_matched"
  | "raw_mae"
  | "corrected_mae"
  | "mae_improvement_pct"
  | "last_prediction_at"
  | "period_start"
  | "period_end"
>;

interface BeachRow {
  id: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

type ForecastAccuracyClient = ReturnType<
  typeof createSupabaseServiceRoleClient
>;

function logForecastAccuracyError(scope: string, error: unknown): void {
  console.warn(`[forecast-accuracy] ${scope} error:`, error);
}

function getForecastAccuracyClient(
  scope: string,
): ForecastAccuracyClient | null {
  try {
    return createSupabaseServiceRoleClient();
  } catch (error) {
    logForecastAccuracyError(`${scope} client`, error);
    return null;
  }
}

function isFiniteMetric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const MIN_VALIDATED_PAIRS_FOR_ROW = 10;
const HIGH_CONFIDENCE_VALIDATED_PAIRS = 50;
const MEDIUM_CONFIDENCE_VALIDATED_PAIRS = 10;
const STALE_CONFIDENCE_DAYS = 14;

function positiveMetricOrNull(value: unknown): number | null {
  return isFiniteMetric(value) && value > 0 ? value : null;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;

  for (const value of values) {
    if (!value) continue;
    if (!latest || new Date(value).getTime() > new Date(latest).getTime()) {
      latest = value;
    }
  }

  return latest;
}

function earliestIso(values: Array<string | null | undefined>): string | null {
  let earliest: string | null = null;

  for (const value of values) {
    if (!value) continue;
    if (!earliest || new Date(value).getTime() < new Date(earliest).getTime()) {
      earliest = value;
    }
  }

  return earliest;
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, (now.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000));
}

function confidenceLabel(level: ForecastAccuracyConfidenceLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function buildForecastAccuracyConfidence({
  validatedPairCount,
  lastUpdated,
  hasBuoyMatches,
  now = new Date(),
}: {
  validatedPairCount: number;
  lastUpdated: string | null;
  hasBuoyMatches: boolean;
  now?: Date;
}): ForecastAccuracyConfidence {
  if (!hasBuoyMatches) {
    return {
      level: "low",
      label: "Model only",
      score: 25,
      sources: ["model"],
      reason: "No validated buoy matches are ready for this report yet.",
    };
  }

  const ageDays = daysSince(lastUpdated, now);
  const isStale = ageDays !== null && ageDays > STALE_CONFIDENCE_DAYS;

  if (
    validatedPairCount >= HIGH_CONFIDENCE_VALIDATED_PAIRS &&
    !isStale &&
    lastUpdated
  ) {
    return {
      level: "high",
      label: "High - buoy + model",
      score: 85,
      sources: ["buoy", "model"],
      reason: "The report has a recent, high-volume buoy-matched sample.",
    };
  }

  if (
    validatedPairCount >= MEDIUM_CONFIDENCE_VALIDATED_PAIRS &&
    !isStale &&
    lastUpdated
  ) {
    return {
      level: "medium",
      label: "Medium - buoy + model",
      score: 65,
      sources: ["buoy", "model"],
      reason: "The report has enough recent buoy-matched data for a cautious read.",
    };
  }

  return {
    level: "low",
    label: "Low - sparse data",
    score: 35,
    sources: hasBuoyMatches ? ["buoy", "model"] : ["model"],
    reason: isStale
      ? "The latest buoy-matched sample is stale."
      : "The buoy-matched sample is still sparse.",
  };
}

function canClaimForecastAccuracyImprovement({
  noaaBaselineMae,
  quiverMae,
  validatedPairCount,
  lastUpdated,
}: {
  noaaBaselineMae: number | null;
  quiverMae: number | null;
  validatedPairCount: number;
  lastUpdated: string | null;
}): boolean {
  if (!lastUpdated) return false;
  if (validatedPairCount < MIN_VALIDATED_PAIRS_FOR_ROW) return false;
  if (!isFiniteMetric(noaaBaselineMae) || noaaBaselineMae <= 0) return false;
  if (!isFiniteMetric(quiverMae) || quiverMae <= 0) return false;
  return quiverMae < noaaBaselineMae;
}

function buildAccuracyBuildingRows(reason: string): ForecastAccuracyBuildingRow[] {
  return [
    {
      id: "validated-pairs",
      label: "Validated forecast-buoy pairs",
      status: "Building",
      detail:
        "Waiting for enough IOOS buoy matches before publishing beach-level accuracy lift.",
      confidenceLabel: "Low - sparse data",
    },
    {
      id: "noaa-comparison",
      label: "NOAA baseline comparison",
      status: "Queued",
      detail:
        "Quiver needs both NOAA baseline MAE and Quiver MAE before showing improvement.",
      confidenceLabel: "Model only",
    },
    {
      id: "accuracy-claim",
      label: "Accuracy lift claim",
      status: "Held",
      detail: reason,
      confidenceLabel: "Low - sparse data",
    },
  ];
}

function buildBuildingReport(reason: string, now = new Date()): ForecastAccuracyReport {
  const confidence = buildForecastAccuracyConfidence({
    validatedPairCount: 0,
    lastUpdated: null,
    hasBuoyMatches: false,
    now,
  });

  return {
    generatedAt: now.toISOString(),
    summary: {
      status: "building",
      beachCount: 0,
      totalPredictions: 0,
      validatedPairCount: 0,
      noaaBaselineMae: null,
      quiverMae: null,
      improvementPct: null,
      lastUpdated: null,
      periodStart: null,
      periodEnd: null,
      confidence,
      canClaimImprovement: false,
    },
    beachRows: [],
    buildingRows: buildAccuracyBuildingRows(reason),
    dailyTimeSeries: [],
    regionalData: [],
  };
}

function mapAccuracyBeachRow(
  row: AccuracyReportMatviewRow,
  beach: BeachRow | undefined,
  now: Date
): ForecastAccuracyBeachRow | null {
  const noaaBaselineMae = positiveMetricOrNull(row.raw_mae);
  const quiverMae = positiveMetricOrNull(row.corrected_mae);
  const improvementPct = isFiniteMetric(row.mae_improvement_pct)
    ? row.mae_improvement_pct
    : noaaBaselineMae && quiverMae
      ? ((noaaBaselineMae - quiverMae) / noaaBaselineMae) * 100
      : null;
  const validatedPairCount = isFiniteMetric(row.predictions_matched)
    ? row.predictions_matched
    : 0;

  if (
    !row.beach_id ||
    !row.beach_name ||
    noaaBaselineMae === null ||
    quiverMae === null ||
    improvementPct === null
  ) {
    return null;
  }

  const confidence = buildForecastAccuracyConfidence({
    validatedPairCount,
    lastUpdated: row.last_prediction_at,
    hasBuoyMatches: validatedPairCount > 0,
    now,
  });

  return {
    id: row.beach_id,
    beachId: row.beach_id,
    beachName: row.beach_name,
    slug: beach?.slug ?? null,
    city: beach?.city ?? null,
    state: beach?.state ?? null,
    country: beach?.country ?? null,
    noaaBaselineMae,
    quiverMae,
    improvementPct,
    validatedPairCount,
    lastUpdated: row.last_prediction_at,
    confidence,
    canClaimImprovement: canClaimForecastAccuracyImprovement({
      noaaBaselineMae,
      quiverMae,
      validatedPairCount,
      lastUpdated: row.last_prediction_at,
    }),
  };
}

function buildAccuracySummary(
  rows: AccuracyReportMatviewRow[],
  beachRows: ForecastAccuracyBeachRow[],
  now: Date
): ForecastAccuracySummary {
  if (beachRows.length === 0) {
    return buildBuildingReport(
      "Accuracy metrics are still building; no qualifying beach rows are ready.",
      now
    ).summary;
  }

  const validatedPairCount = beachRows.reduce(
    (sum, row) => sum + row.validatedPairCount,
    0
  );
  const totalPredictions = rows.reduce(
    (sum, row) => sum + (isFiniteMetric(row.predictions_total) ? row.predictions_total : 0),
    0
  );
  const weightedNoaaMae =
    beachRows.reduce(
      (sum, row) => sum + row.noaaBaselineMae * row.validatedPairCount,
      0
    ) / Math.max(1, validatedPairCount);
  const weightedQuiverMae =
    beachRows.reduce(
      (sum, row) => sum + row.quiverMae * row.validatedPairCount,
      0
    ) / Math.max(1, validatedPairCount);
  const improvementPct =
    weightedNoaaMae > 0
      ? ((weightedNoaaMae - weightedQuiverMae) / weightedNoaaMae) * 100
      : null;
  const lastUpdated = latestIso(beachRows.map((row) => row.lastUpdated));
  const confidence = buildForecastAccuracyConfidence({
    validatedPairCount,
    lastUpdated,
    hasBuoyMatches: validatedPairCount > 0,
    now,
  });

  return {
    status: "live",
    beachCount: beachRows.length,
    totalPredictions,
    validatedPairCount,
    noaaBaselineMae: weightedNoaaMae,
    quiverMae: weightedQuiverMae,
    improvementPct,
    lastUpdated,
    periodStart: earliestIso(rows.map((row) => row.period_start)),
    periodEnd: latestIso(rows.map((row) => row.period_end)),
    confidence,
    canClaimImprovement: canClaimForecastAccuracyImprovement({
      noaaBaselineMae: weightedNoaaMae,
      quiverMae: weightedQuiverMae,
      validatedPairCount,
      lastUpdated,
    }),
  };
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Single report model for the public /forecast-accuracy trust page.
 * The UI should render from this state instead of re-deciding claim policy.
 */
export async function getForecastAccuracyReport(): Promise<ForecastAccuracyReport> {
  const now = new Date();
  const supabase = getForecastAccuracyClient("getForecastAccuracyReport");
  if (!supabase) {
    return buildBuildingReport(
      "Accuracy metrics are still building; the public report client is not ready.",
      now
    );
  }

  try {
    const { data: matviewRows, error: matviewError } = await supabase
      .from("beach_ml_performance_baseline")
      .select(
        [
          "beach_id",
          "beach_name",
          "predictions_total",
          "predictions_matched",
          "raw_mae",
          "corrected_mae",
          "mae_improvement_pct",
          "last_prediction_at",
          "period_start",
          "period_end",
        ].join(", "),
      )
      .gte("predictions_matched", 5)
      .order("predictions_matched", { ascending: false })
      .limit(20);

    if (matviewError) {
      logForecastAccuracyError("getForecastAccuracyReport baseline", matviewError);
      return buildBuildingReport(
        "Accuracy metrics are still building; baseline rows are not ready.",
        now
      );
    }

    const rows = (matviewRows ?? []) as unknown as AccuracyReportMatviewRow[];
    if (rows.length === 0) {
      return buildBuildingReport(
        "Accuracy metrics are still building; no qualifying buoy-matched rows are ready.",
        now
      );
    }

    const beachIds = rows
      .map((row) => row.beach_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, slug, city, state, country")
      .in("id", beachIds);

    if (beachError) {
      logForecastAccuracyError("getForecastAccuracyReport beaches", beachError);
    }

    const beachMap = new Map<string, BeachRow>();
    for (const beach of (beaches ?? []) as BeachRow[]) {
      beachMap.set(beach.id, beach);
    }

    const beachRows = rows
      .map((row) => mapAccuracyBeachRow(row, beachMap.get(row.beach_id), now))
      .filter((row): row is ForecastAccuracyBeachRow => row !== null);
    const summary = buildAccuracySummary(rows, beachRows, now);

    if (beachRows.length === 0) {
      return {
        ...buildBuildingReport(
          "Accuracy metrics are still building; no displayable beach rows are ready.",
          now
        ),
        generatedAt: now.toISOString(),
      };
    }

    const [regionalData, dailyTimeSeries] = await Promise.all([
      getRegionalAccuracy(),
      getDailyAccuracyTimeSeries(),
    ]);

    return {
      generatedAt: now.toISOString(),
      summary,
      beachRows,
      buildingRows:
        summary.status === "building"
          ? buildAccuracyBuildingRows(
              "Accuracy metrics are still building; no positive lift claim is ready."
            )
          : [],
      dailyTimeSeries,
      regionalData,
    };
  } catch (error) {
    logForecastAccuracyError("getForecastAccuracyReport unexpected", error);
    return buildBuildingReport(
      "Accuracy metrics are still building after an unexpected report error.",
      now
    );
  }
}

/**
 * Aggregate accuracy statistics across all beaches with >= 10 matched predictions.
 * Used for the hero stat cards.
 */
export async function getOverallAccuracyStats(): Promise<OverallAccuracyStats | null> {
  const supabase = getForecastAccuracyClient("getOverallAccuracyStats");
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("beach_ml_performance_baseline")
      .select(
        "raw_mae, corrected_mae, mae_improvement_pct, predictions_total, predictions_matched",
      )
      .gte("predictions_matched", 10);

    if (error) {
      logForecastAccuracyError("getOverallAccuracyStats", error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const rows = data as Pick<
      MatviewRow,
      | "raw_mae"
      | "corrected_mae"
      | "mae_improvement_pct"
      | "predictions_total"
      | "predictions_matched"
    >[];

    const beachCount = rows.length;
    const totalPredictions = rows.reduce(
      (sum, r) => sum + (r.predictions_total ?? 0),
      0,
    );
    const avgRawMae =
      rows.reduce((sum, r) => sum + (r.raw_mae ?? 0), 0) / beachCount;
    const avgCorrectedMae =
      rows.reduce((sum, r) => sum + (r.corrected_mae ?? 0), 0) / beachCount;
    // Compute improvement from aggregate MAE values, not from averaging per-beach
    // percentages. Averaging per-beach %s is misleading — beaches with tiny MAE
    // (where even small improvements show low %) drag down the headline number.
    const avgImprovementPct =
      avgRawMae > 0 ? ((avgRawMae - avgCorrectedMae) / avgRawMae) * 100 : 0;

    return {
      avgRawMae,
      avgCorrectedMae,
      avgImprovementPct,
      beachCount,
      totalPredictions,
    };
  } catch (error) {
    logForecastAccuracyError("getOverallAccuracyStats unexpected", error);
    return null;
  }
}

/**
 * Accuracy statistics grouped by US state.
 * Requires the beach row from the beaches table for the state field.
 * Only includes states with 3+ beaches having data.
 * Sorted by improvement % descending.
 */
export async function getRegionalAccuracy(): Promise<RegionalAccuracyRow[]> {
  const supabase = getForecastAccuracyClient("getRegionalAccuracy");
  if (!supabase) return [];

  try {
    // Fetch all qualifying matview rows
    const { data: matviewRows, error: matviewError } = await supabase
      .from("beach_ml_performance_baseline")
      .select(
        "beach_id, raw_mae, corrected_mae, mae_improvement_pct, predictions_matched",
      )
      .gte("predictions_matched", 10);

    if (matviewError || !matviewRows || matviewRows.length === 0) {
      if (matviewError) {
        logForecastAccuracyError("getRegionalAccuracy matview", matviewError);
      }
      return [];
    }

    // Fetch beach state info for all beach IDs
    const beachIds = (matviewRows as { beach_id: string }[]).map(
      (r) => r.beach_id,
    );
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, state")
      .in("id", beachIds);

    if (beachError || !beaches) {
      logForecastAccuracyError("getRegionalAccuracy beaches", beachError);
      return [];
    }

    // Build a beach_id -> state lookup
    const stateByBeach = new Map<string, string>();
    for (const b of beaches as { id: string; state: string | null }[]) {
      if (b.state) stateByBeach.set(b.id, b.state);
    }

    // Group by state
    const byState = new Map<
      string,
      {
        rawMaeSum: number;
        correctedMaeSum: number;
        improvementSum: number;
        count: number;
      }
    >();

    for (const row of matviewRows as Pick<
      MatviewRow,
      | "beach_id"
      | "raw_mae"
      | "corrected_mae"
      | "mae_improvement_pct"
      | "predictions_matched"
    >[]) {
      const state = stateByBeach.get(row.beach_id);
      if (!state) continue;

      const existing = byState.get(state) ?? {
        rawMaeSum: 0,
        correctedMaeSum: 0,
        improvementSum: 0,
        count: 0,
      };

      existing.rawMaeSum += row.raw_mae ?? 0;
      existing.correctedMaeSum += row.corrected_mae ?? 0;
      existing.improvementSum += row.mae_improvement_pct ?? 0;
      existing.count += 1;

      byState.set(state, existing);
    }

    // Build result, filter to states with 3+ beaches, sort by improvement
    const result: RegionalAccuracyRow[] = [];
    for (const [state, agg] of byState.entries()) {
      if (agg.count < 3) continue;
      result.push({
        state,
        avgRawMae: agg.rawMaeSum / agg.count,
        avgCorrectedMae: agg.correctedMaeSum / agg.count,
        avgImprovementPct: agg.improvementSum / agg.count,
        beachCount: agg.count,
      });
    }

    return result.sort((a, b) => b.avgImprovementPct - a.avgImprovementPct);
  } catch (error) {
    logForecastAccuracyError("getRegionalAccuracy unexpected", error);
    return [];
  }
}

/**
 * Top 20 beaches by ML improvement percentage.
 * Requires >= 20 matched predictions for statistical reliability.
 */
export async function getTopBeaches(): Promise<TopBeachRow[]> {
  const supabase = getForecastAccuracyClient("getTopBeaches");
  if (!supabase) return [];

  try {
    // Fetch qualifying matview rows ordered by improvement
    const { data: matviewRows, error: matviewError } = await supabase
      .from("beach_ml_performance_baseline")
      .select(
        "beach_id, beach_name, raw_mae, corrected_mae, mae_improvement_pct, predictions_matched",
      )
      .gte("predictions_matched", 20)
      .order("mae_improvement_pct", { ascending: false })
      .limit(20);

    if (matviewError || !matviewRows || matviewRows.length === 0) {
      if (matviewError) {
        logForecastAccuracyError("getTopBeaches matview", matviewError);
      }
      return [];
    }

    // Fetch beach URL data for all beach IDs
    const beachIds = (matviewRows as Pick<MatviewRow, "beach_id">[]).map(
      (r) => r.beach_id,
    );
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, slug, city, state, country")
      .in("id", beachIds);

    if (beachError) {
      logForecastAccuracyError("getTopBeaches beaches", beachError);
    }

    // Build a beach_id -> beach lookup
    const beachMap = new Map<string, BeachRow>();
    for (const b of (beaches ?? []) as BeachRow[]) {
      beachMap.set(b.id, b);
    }

    return (
      matviewRows as Pick<
        MatviewRow,
        | "beach_id"
        | "beach_name"
        | "raw_mae"
        | "corrected_mae"
        | "mae_improvement_pct"
        | "predictions_matched"
      >[]
    ).flatMap((row) => {
      if (
        !isFiniteMetric(row.raw_mae) ||
        !isFiniteMetric(row.corrected_mae) ||
        !isFiniteMetric(row.mae_improvement_pct) ||
        !isFiniteMetric(row.predictions_matched)
      ) {
        return [];
      }

      const beach = beachMap.get(row.beach_id);
      return [
        {
          beachId: row.beach_id,
          beachName: row.beach_name,
          slug: beach?.slug ?? null,
          city: beach?.city ?? null,
          state: beach?.state ?? null,
          country: beach?.country ?? null,
          rawMae: row.raw_mae,
          correctedMae: row.corrected_mae,
          maeImprovementPct: row.mae_improvement_pct,
          predictionsMatched: row.predictions_matched,
        },
      ];
    });
  } catch (error) {
    logForecastAccuracyError("getTopBeaches unexpected", error);
    return [];
  }
}

/**
 * Daily MAE time-series from ml_predictions_log over the last 30 days.
 * Groups by date, returning average raw and corrected error per day.
 * Only includes rows where an observation was recorded (observed_m > 0).
 */
export async function getDailyAccuracyTimeSeries(): Promise<
  DailyAccuracyPoint[]
> {
  const supabase = getForecastAccuracyClient("getDailyAccuracyTimeSeries");
  if (!supabase) return [];

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("ml_predictions_log")
      .select("predicted_at, raw_error_m, corrected_error_m")
      .gt("observed_m", 0)
      .gte("predicted_at", thirtyDaysAgo.toISOString())
      .order("predicted_at", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) {
        logForecastAccuracyError("getDailyAccuracyTimeSeries", error);
      }
      return [];
    }

    // Group by date in JS
    const byDate = new Map<
      string,
      { rawSum: number; correctedSum: number; count: number }
    >();

    for (const row of data as {
      predicted_at: string;
      raw_error_m: number | null;
      corrected_error_m: number | null;
    }[]) {
      const date = row.predicted_at.split("T")[0];
      const existing = byDate.get(date) ?? {
        rawSum: 0,
        correctedSum: 0,
        count: 0,
      };
      existing.rawSum += Math.abs(row.raw_error_m ?? 0);
      existing.correctedSum += Math.abs(row.corrected_error_m ?? 0);
      existing.count += 1;
      byDate.set(date, existing);
    }

    const result: DailyAccuracyPoint[] = [];
    for (const [date, agg] of byDate.entries()) {
      result.push({
        date,
        rawMae: agg.rawSum / agg.count,
        correctedMae: agg.correctedSum / agg.count,
        count: agg.count,
      });
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    logForecastAccuracyError("getDailyAccuracyTimeSeries unexpected", error);
    return [];
  }
}

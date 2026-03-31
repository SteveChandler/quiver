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

interface BeachRow {
  id: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Aggregate accuracy statistics across all beaches with >= 10 matched predictions.
 * Used for the hero stat cards.
 */
export async function getOverallAccuracyStats(): Promise<OverallAccuracyStats | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("beach_ml_performance_baseline")
    .select(
      "raw_mae, corrected_mae, mae_improvement_pct, predictions_total, predictions_matched"
    )
    .gte("predictions_matched", 10);

  if (error) {
    console.error("[forecast-accuracy] getOverallAccuracyStats error:", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const rows = data as Pick<
    MatviewRow,
    "raw_mae" | "corrected_mae" | "mae_improvement_pct" | "predictions_total" | "predictions_matched"
  >[];

  const beachCount = rows.length;
  const totalPredictions = rows.reduce((sum, r) => sum + (r.predictions_total ?? 0), 0);
  const avgRawMae = rows.reduce((sum, r) => sum + (r.raw_mae ?? 0), 0) / beachCount;
  const avgCorrectedMae =
    rows.reduce((sum, r) => sum + (r.corrected_mae ?? 0), 0) / beachCount;
  // Compute improvement from aggregate MAE values, not from averaging per-beach
  // percentages. Averaging per-beach %s is misleading — beaches with tiny MAE
  // (where even small improvements show low %) drag down the headline number.
  const avgImprovementPct =
    avgRawMae > 0
      ? ((avgRawMae - avgCorrectedMae) / avgRawMae) * 100
      : 0;

  return {
    avgRawMae,
    avgCorrectedMae,
    avgImprovementPct,
    beachCount,
    totalPredictions,
  };
}

/**
 * Accuracy statistics grouped by US state.
 * Requires the beach row from the beaches table for the state field.
 * Only includes states with 3+ beaches having data.
 * Sorted by improvement % descending.
 */
export async function getRegionalAccuracy(): Promise<RegionalAccuracyRow[]> {
  const supabase = createSupabaseServiceRoleClient();

  // Fetch all qualifying matview rows
  const { data: matviewRows, error: matviewError } = await supabase
    .from("beach_ml_performance_baseline")
    .select("beach_id, raw_mae, corrected_mae, mae_improvement_pct, predictions_matched")
    .gte("predictions_matched", 10);

  if (matviewError || !matviewRows || matviewRows.length === 0) {
    if (matviewError) {
      console.error("[forecast-accuracy] getRegionalAccuracy matview error:", matviewError);
    }
    return [];
  }

  // Fetch beach state info for all beach IDs
  const beachIds = (matviewRows as { beach_id: string }[]).map((r) => r.beach_id);
  const { data: beaches, error: beachError } = await supabase
    .from("beaches")
    .select("id, state")
    .in("id", beachIds);

  if (beachError || !beaches) {
    console.error("[forecast-accuracy] getRegionalAccuracy beaches error:", beachError);
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
    { rawMaeSum: number; correctedMaeSum: number; improvementSum: number; count: number }
  >();

  for (const row of matviewRows as Pick<
    MatviewRow,
    "beach_id" | "raw_mae" | "corrected_mae" | "mae_improvement_pct" | "predictions_matched"
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
}

/**
 * Top 20 beaches by ML improvement percentage.
 * Requires >= 20 matched predictions for statistical reliability.
 */
export async function getTopBeaches(): Promise<TopBeachRow[]> {
  const supabase = createSupabaseServiceRoleClient();

  // Fetch qualifying matview rows ordered by improvement
  const { data: matviewRows, error: matviewError } = await supabase
    .from("beach_ml_performance_baseline")
    .select(
      "beach_id, beach_name, raw_mae, corrected_mae, mae_improvement_pct, predictions_matched"
    )
    .gte("predictions_matched", 20)
    .order("mae_improvement_pct", { ascending: false })
    .limit(20);

  if (matviewError || !matviewRows || matviewRows.length === 0) {
    if (matviewError) {
      console.error("[forecast-accuracy] getTopBeaches matview error:", matviewError);
    }
    return [];
  }

  // Fetch beach URL data for all beach IDs
  const beachIds = (matviewRows as Pick<MatviewRow, "beach_id">[]).map((r) => r.beach_id);
  const { data: beaches, error: beachError } = await supabase
    .from("beaches")
    .select("id, slug, city, state, country")
    .in("id", beachIds);

  if (beachError) {
    console.error("[forecast-accuracy] getTopBeaches beaches error:", beachError);
  }

  // Build a beach_id -> beach lookup
  const beachMap = new Map<string, BeachRow>();
  for (const b of (beaches ?? []) as BeachRow[]) {
    beachMap.set(b.id, b);
  }

  return (
    matviewRows as Pick<
      MatviewRow,
      "beach_id" | "beach_name" | "raw_mae" | "corrected_mae" | "mae_improvement_pct" | "predictions_matched"
    >[]
  ).map((row) => {
    const beach = beachMap.get(row.beach_id);
    return {
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
    };
  });
}

/**
 * Daily MAE time-series from ml_predictions_log over the last 30 days.
 * Groups by date, returning average raw and corrected error per day.
 * Only includes rows where an observation was recorded (observed_m > 0).
 */
export async function getDailyAccuracyTimeSeries(): Promise<DailyAccuracyPoint[]> {
  const supabase = createSupabaseServiceRoleClient();

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
      console.error("[forecast-accuracy] getDailyAccuracyTimeSeries error:", error);
    }
    return [];
  }

  // Group by date in JS
  const byDate = new Map<string, { rawSum: number; correctedSum: number; count: number }>();

  for (const row of data as {
    predicted_at: string;
    raw_error_m: number | null;
    corrected_error_m: number | null;
  }[]) {
    const date = row.predicted_at.split("T")[0];
    const existing = byDate.get(date) ?? { rawSum: 0, correctedSum: 0, count: 0 };
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
}

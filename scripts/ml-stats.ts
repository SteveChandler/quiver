#!/usr/bin/env node
/**
 * ML Pipeline Health Dashboard
 *
 * Queries Fly.io endpoints and Supabase tables to produce a markdown
 * dashboard of the Quiver ML pipeline health.
 *
 * Usage:
 *   npx tsx scripts/ml-stats.ts 2>/dev/null
 */

import { config } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthEndpoint {
  model_loaded: boolean;
  model_version: string;
  candidate_loaded?: boolean;
  candidate_version?: string;
  uptime_seconds?: number;
  [key: string]: unknown;
}

interface CronJob {
  name: string;
  next_run: string;
  interval_seconds?: number;
  last_run?: string;
  status?: string;
  [key: string]: unknown;
}

interface CronStatus {
  jobs: CronJob[];
  [key: string]: unknown;
}

interface ModelRegistryRow {
  version: string;
  status: string;
  holdout_improvement_pct: number | null;
  holdout_raw_mae: number | null;
  holdout_corrected_mae: number | null;
  production_improvement_pct: number | null;
  training_samples: number;
  training_window_days: number;
  notes: string | null;
  created_at: string;
  deployed_at: string | null;
}

interface PipelineHealthRow {
  total_predictions: number;
  pending_observations: number;
  pending_12_24h: number;
  pending_gt_24h: number;
  sentinel_marked: number;
  matched_last_24h: number;
  total_observable_24h: number;
  match_rate_24h: number;
  avg_raw_error_24h: number;
  avg_corrected_error_24h: number;
  improvement_pct_24h: number;
  oldest_pending_age_hours: number;
  observable_beaches_count: number;
}

interface WeeklyMetricsRow {
  model_version: string;
  predictions: number;
  with_ground_truth: number;
  avg_raw_error_m: number;
  avg_corrected_error_m: number;
  avg_improvement_m: number;
  pct_improved: number;
}

interface CorrectionStats {
  latest_corrected_at: string | null;
  count_24h: number;
  total: number;
}

interface PredictionDayCount {
  day: string;
  count: number;
}

interface PredictionStats {
  daily_counts: PredictionDayCount[];
  total: number;
  latest_predicted_at: string | null;
}

interface SessionWaveObservationFunnel {
  real_completed_sessions?: number;
  candidate_rows?: number;
  valid_height_candidates?: number;
  matched_to_ml_within_6h?: number;
  matched_with_buoy_truth?: number;
  candidate_sessions_7d?: number;
  candidate_sessions_30d?: number;
}

interface SessionWaveObservationQuality {
  user_vs_buoy_abs_error_avg_m?: number | null;
  user_vs_buoy_abs_error_median_m?: number | null;
  user_vs_buoy_abs_error_p75_m?: number | null;
  user_vs_buoy_abs_error_p90_m?: number | null;
  user_vs_buoy_signed_bias_avg_m?: number | null;
  display_abs_error_avg_m?: number | null;
  raw_om_abs_error_avg_m?: number | null;
  v5_shadow_abs_error_avg_m?: number | null;
  user_beats_display_count?: number;
  display_comparison_count?: number;
  user_beats_v5_shadow_count?: number;
  v5_shadow_comparison_count?: number;
}

interface SessionWaveObservationCounts {
  by_quality_state?: Record<string, number>;
  by_source_created_by?: Record<string, number>;
  effective_weak_label_mass?: number;
}

interface SessionTruthDiagnostics {
  wave_height_sessions_90d_raw?: number;
  wave_height_sessions_90d_non_deleted?: number;
  wave_height_sessions_90d_strict_real?: number;
  wave_height_sessions_90d_excluded_by_analytics_flag?: number;
  wave_height_sessions_90d_mock_or_test_diagnostic?: number;
  wave_height_sessions_90d_bot_flagged?: number;
  wave_height_sessions_90d_snapshot_linked?: number;
}

interface AnonymousUserReliability {
  anonymous_user_rank: number;
  comparisons: number;
  avg_abs_error_m: number | null;
  median_abs_error_m: number | null;
  p75_abs_error_m: number | null;
  avg_signed_bias_m: number | null;
}

interface MatchDeltaBucket {
  bucket: string;
  candidates: number;
  with_buoy_truth: number;
}

interface SessionWaveObservationAnalytics {
  generated_at?: string;
  session_truth?: SessionTruthDiagnostics;
  funnel?: SessionWaveObservationFunnel;
  quality?: SessionWaveObservationQuality;
  candidate_counts?: SessionWaveObservationCounts;
  anonymous_user_reliability?: AnonymousUserReliability[];
  match_delta_buckets?: MatchDeltaBucket[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "n/a";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function hoursAgo(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function formatMaybeNumber(
  value: number | null | undefined,
  decimals = 0,
  suffix = ""
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(decimals)}${suffix}`;
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  ).trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchHealthEndpoint(): Promise<{
  data: HealthEndpoint | null;
  error: string | null;
}> {
  const data = await fetchJson<HealthEndpoint>(
    "https://quiver-ml.fly.dev/health"
  );
  if (!data) return { data: null, error: "ML service unreachable" };
  return { data, error: null };
}

async function fetchCronStatus(): Promise<{
  data: CronStatus | null;
  error: string | null;
}> {
  const data = await fetchJson<CronStatus>(
    "https://quiver-ml.fly.dev/crons/status"
  );
  if (!data) return { data: null, error: "Cron status endpoint unreachable" };
  return { data, error: null };
}

async function fetchPipelineHealth(
  supabase: SupabaseClient
): Promise<{ data: PipelineHealthRow | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("get_ml_health_metrics");
    if (error) return { data: null, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row ?? null, error: null };
  } catch (e: unknown) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

async function fetchWeeklyMetrics(
  supabase: SupabaseClient
): Promise<{ data: WeeklyMetricsRow[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("get_ml_weekly_metrics");
    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (e: unknown) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

async function fetchModelRegistry(
  supabase: SupabaseClient
): Promise<{ data: ModelRegistryRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ml_model_registry")
    .select(
      "version, status, holdout_improvement_pct, holdout_raw_mae, holdout_corrected_mae, production_improvement_pct, training_samples, training_window_days, notes, created_at, deployed_at"
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return { data: null, error: error.message };
  return { data: (data as ModelRegistryRow[]) ?? [], error: null };
}

async function fetchCorrectionStats(
  supabase: SupabaseClient
): Promise<{ data: CorrectionStats | null; error: string | null }> {
  // Latest correction time
  const { data: latest, error: e1 } = await supabase
    .from("corrected_forecasts")
    .select("corrected_at")
    .order("corrected_at", { ascending: false })
    .limit(1)
    .single();

  if (e1 && e1.code !== "PGRST116") {
    return { data: null, error: e1.message };
  }

  // Count in last 24h
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count: count24h, error: e2 } = await supabase
    .from("corrected_forecasts")
    .select("id", { count: "exact", head: true })
    .gte("corrected_at", since);

  if (e2) return { data: null, error: e2.message };

  // Total count
  const { count: total, error: e3 } = await supabase
    .from("corrected_forecasts")
    .select("id", { count: "exact", head: true });

  if (e3) return { data: null, error: e3.message };

  return {
    data: {
      latest_corrected_at: latest?.corrected_at ?? null,
      count_24h: count24h ?? 0,
      total: total ?? 0,
    },
    error: null,
  };
}

async function fetchPredictionStats(
  supabase: SupabaseClient
): Promise<{ data: PredictionStats | null; error: string | null }> {
  // Latest prediction
  const { data: latestRow, error: e1 } = await supabase
    .from("ml_predictions_log")
    .select("predicted_at")
    .order("predicted_at", { ascending: false })
    .limit(1)
    .single();

  if (e1 && e1.code !== "PGRST116") {
    return { data: null, error: e1.message };
  }

  // Total count
  const { count: total, error: e2 } = await supabase
    .from("ml_predictions_log")
    .select("id", { count: "exact", head: true });

  if (e2) return { data: null, error: e2.message };

  // Daily counts for last 10 days — fetch all recent predictions and bucket client-side
  // since Supabase JS doesn't support date_trunc grouping
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const { count: recentCount, error: e3 } = await supabase
    .from("ml_predictions_log")
    .select("id", { count: "exact", head: true })
    .gte("predicted_at", tenDaysAgo);

  if (e3) return { data: null, error: e3.message };

  // Build per-day counts by querying each day individually
  const dailyCounts: PredictionDayCount[] = [];
  for (let i = 9; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    dayStart.setUTCDate(dayStart.getUTCDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const { count, error } = await supabase
      .from("ml_predictions_log")
      .select("id", { count: "exact", head: true })
      .gte("predicted_at", dayStart.toISOString())
      .lt("predicted_at", dayEnd.toISOString());

    if (!error) {
      dailyCounts.push({
        day: dayStart.toISOString().slice(0, 10),
        count: count ?? 0,
      });
    }
  }

  return {
    data: {
      daily_counts: dailyCounts,
      total: total ?? 0,
      latest_predicted_at: latestRow?.predicted_at ?? null,
    },
    error: null,
  };
}

async function fetchSessionWaveObservationAnalytics(
  supabase: SupabaseClient
): Promise<{
  data: SessionWaveObservationAnalytics | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc(
      "get_session_wave_observation_analytics"
    );
    if (error) return { data: null, error: error.message };
    return {
      data: (data as SessionWaveObservationAnalytics | null) ?? null,
      error: null,
    };
  } catch (e: unknown) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

function detectAnomalies(
  health: HealthEndpoint | null,
  healthError: string | null,
  cron: CronStatus | null,
  pipeline: PipelineHealthRow | null,
  registry: ModelRegistryRow[] | null,
  corrections: CorrectionStats | null,
  predictions: PredictionStats | null
): string[] {
  const flags: string[] = [];

  // Service health
  if (healthError || !health) {
    flags.push("ML service unreachable");
  } else if (!health.model_loaded) {
    flags.push("Model not loaded on Fly.io service");
  }

  // Correction freshness
  if (corrections) {
    const corrAge = hoursAgo(corrections.latest_corrected_at);
    if (corrAge !== null && corrAge > 6) {
      flags.push(
        `Corrections stale — last correction ${corrAge.toFixed(1)}h ago (threshold: 6h)`
      );
    }
  }

  // Predictions in last 24h
  if (predictions) {
    const last24h = predictions.daily_counts.slice(-1)[0];
    if (last24h && last24h.count === 0) {
      flags.push("0 predictions in last 24h");
    }
  }

  // Pipeline health RPC anomalies
  if (pipeline) {
    if (pipeline.match_rate_24h > 100) {
      flags.push(
        "Match rate exceeds 100% — some <4h predictions already matched. Cosmetic issue, pipeline is healthy."
      );
    }
    if (pipeline.match_rate_24h < 15) {
      flags.push(
        "Low match rate — check IOOS station sync and variable aliases"
      );
    }
    if (pipeline.improvement_pct_24h < 5) {
      flags.push("Correction model underperforming (<5% improvement)");
    }
    if (pipeline.pending_gt_24h > 0) {
      flags.push(
        `${pipeline.pending_gt_24h} stale pending predictions (>24h) — check cron job`
      );
    }
    if (pipeline.oldest_pending_age_hours > 48) {
      flags.push(
        `Very old pending predictions (${pipeline.oldest_pending_age_hours}h)`
      );
    }
    if (pipeline.observable_beaches_count < 30) {
      flags.push(
        `Low observable beaches (${pipeline.observable_beaches_count}) — check IOOS station sync`
      );
    }
    if (pipeline.observable_beaches_count > 100) {
      flags.push(
        `High observable count (${pipeline.observable_beaches_count}) — verify recency filter`
      );
    }
  }

  // Model registry anomalies
  if (registry && registry.length > 0) {
    const latest = registry[0];
    if (latest.status === "failed") {
      flags.push(
        "Most recent training failed — check Fly.io logs (fly logs -a quiver-ml)"
      );
    }
    if (latest.status === "training") {
      const trainingAge = hoursAgo(latest.created_at);
      if (trainingAge !== null && trainingAge > 0.5) {
        flags.push("Training may be stuck (>30 min)");
      }
    }

    // 3+ consecutive failures
    let consecutiveFailures = 0;
    for (const m of registry) {
      if (m.status === "failed") {
        consecutiveFailures++;
      } else {
        break;
      }
    }
    if (consecutiveFailures >= 3) {
      flags.push(
        `${consecutiveFailures} consecutive training failures — check adaptive gate thresholds`
      );
    }

    // No deployed/validated in last 14 days
    const fourteenDaysAgo = Date.now() - 14 * 86_400_000;
    const hasRecent = registry.some(
      (m) =>
        (m.status === "deployed" || m.status === "validated") &&
        new Date(m.created_at).getTime() > fourteenDaysAgo
    );
    if (!hasRecent) {
      flags.push(
        "No deployed or validated model in last 14 days — pipeline may need attention"
      );
    }

    // Validated but not promoted (>48h)
    const validatedModels = registry.filter((m) => m.status === "validated");
    for (const m of validatedModels) {
      const age = hoursAgo(m.created_at);
      if (age !== null && age > 48) {
        flags.push(
          `Candidate ${m.version} validated ${age.toFixed(0)}h ago but not promoted — check promote-candidate cron`
        );
      }
    }

    // Rolled back
    const rolledBack = registry.find((m) => m.status === "rolled_back");
    if (rolledBack) {
      flags.push(
        `Auto-rollback triggered on ${rolledBack.version} — check drift detection logs`
      );
    }

    // Deployed model with low production improvement
    const deployed = registry.find((m) => m.status === "deployed");
    if (
      deployed &&
      deployed.production_improvement_pct !== null &&
      deployed.production_improvement_pct < 25
    ) {
      flags.push(
        `Deployed model ${deployed.version} has low production improvement (${deployed.production_improvement_pct}%)`
      );
    }

    // Version mismatch with Fly.io
    if (health && deployed && health.model_version !== deployed.version) {
      flags.push(
        `Version mismatch — Fly.io running ${health.model_version}, DB deployed ${deployed.version}`
      );
    }
  }

  // Cron anomalies
  if (cron?.jobs) {
    for (const job of cron.jobs) {
      if (job.next_run && job.interval_seconds) {
        const nextRunMs = new Date(job.next_run).getTime();
        const nowMs = Date.now();
        const overdueMs = nextRunMs - nowMs;
        // If next_run is more than 2x interval in the past, it's overdue
        if (overdueMs < -(job.interval_seconds * 2000)) {
          flags.push(
            `Cron "${job.name}" overdue — next_run was ${relativeTime(job.next_run)}`
          );
        }
      }
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Markdown formatters
// ---------------------------------------------------------------------------

function formatHealthSection(
  health: HealthEndpoint | null,
  error: string | null
): string {
  if (error || !health) {
    return `### Service Health\n\nWarning: ${error ?? "No data"}\n`;
  }

  const lines = [
    "### Service Health",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Model Loaded | ${health.model_loaded ? "Yes" : "**NO**"} |`,
    `| Model Version | ${health.model_version ?? "n/a"} |`,
    `| Candidate Loaded | ${health.candidate_loaded ? `Yes (${health.candidate_version})` : "No"} |`,
    `| Uptime | ${health.uptime_seconds ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m` : "n/a"} |`,
  ];
  return lines.join("\n");
}

function formatCronSection(
  cron: CronStatus | null,
  error: string | null
): string {
  if (error || !cron) {
    return `### Cron Schedule\n\nWarning: ${error ?? "No data"}\n`;
  }

  const lines = [
    "### Cron Schedule",
    "",
    "| Job | Next Run | Status |",
    "|-----|----------|--------|",
  ];
  const jobs = cron.jobs ?? [];
  for (const job of jobs) {
    const nextRunDisplay = job.next_run
      ? relativeTime(job.next_run)
      : "n/a";
    const status = job.status ?? "unknown";
    lines.push(`| ${job.name} | ${nextRunDisplay} | ${status} |`);
  }
  return lines.join("\n");
}

function formatPipelineHealth(
  data: PipelineHealthRow | null,
  error: string | null
): string {
  if (error || !data) {
    return `### Pipeline Health\n\nWarning: ${error ?? "No data"}\n`;
  }

  const matchRate =
    data.match_rate_24h === null || data.match_rate_24h === undefined
      ? null
      : Math.min(data.match_rate_24h, 100);
  const matchNote =
    data.match_rate_24h !== null &&
    data.match_rate_24h !== undefined &&
    data.match_rate_24h > 100
      ? ` (raw: ${data.match_rate_24h.toFixed(1)}% — capped)`
      : "";

  const lines = [
    "### Pipeline Health (24h)",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Total Predictions | ${formatMaybeNumber(data.total_predictions)} |`,
    `| Pending Observations | ${formatMaybeNumber(data.pending_observations)} |`,
    `| Pending 12-24h | ${formatMaybeNumber(data.pending_12_24h)} |`,
    `| Pending >24h | ${formatMaybeNumber(data.pending_gt_24h)} |`,
    `| Oldest Pending Age | ${formatMaybeNumber(data.oldest_pending_age_hours, 1, "h")} |`,
    `| Observable Beaches | ${formatMaybeNumber(data.observable_beaches_count)} |`,
    `| Matched / Observable | ${formatMaybeNumber(data.matched_last_24h)} / ${formatMaybeNumber(data.total_observable_24h)} |`,
    `| Match Rate | ${formatMaybeNumber(matchRate, 1, "%")}${matchNote} |`,
    `| MAE (Raw) | ${formatMaybeNumber(data.avg_raw_error_24h, 3, "m")} |`,
    `| MAE (Corrected) | ${formatMaybeNumber(data.avg_corrected_error_24h, 3, "m")} |`,
    `| Improvement | ${formatMaybeNumber(data.improvement_pct_24h, 1, "%")} |`,
  ];
  return lines.join("\n");
}

function formatWeeklyMetrics(
  data: WeeklyMetricsRow[] | null,
  error: string | null
): string {
  if (error || !data) {
    return `### Model Performance by Version\n\nWarning: ${error ?? "No data"}\n`;
  }
  if (data.length === 0) {
    return "### Model Performance by Version\n\nNo weekly metrics data.\n";
  }

  const lines = [
    "### Model Performance by Version",
    "",
    "| Model | Predictions | Ground Truth | Raw MAE | Corrected MAE | Improvement |",
    "|-------|-------------|--------------|---------|---------------|-------------|",
  ];
  for (const row of data) {
    lines.push(
      `| ${row.model_version} | ${formatMaybeNumber(row.predictions)} | ${formatMaybeNumber(row.with_ground_truth)} | ${formatMaybeNumber(row.avg_raw_error_m, 3, "m")} | ${formatMaybeNumber(row.avg_corrected_error_m, 3, "m")} | ${formatMaybeNumber(row.pct_improved, 1, "%")} |`
    );
  }
  return lines.join("\n");
}

function formatModelRegistry(
  data: ModelRegistryRow[] | null,
  error: string | null
): string {
  if (error || !data) {
    return `### Model Registry\n\nWarning: ${error ?? "No data"}\n`;
  }
  if (data.length === 0) {
    return "### Model Registry\n\nNo models in registry.\n";
  }

  const lines = [
    "### Model Registry (last 10)",
    "",
    "| Version | Status | Holdout Impr | Raw MAE | Corrected MAE | Samples | Window | Created |",
    "|---------|--------|-------------|---------|---------------|---------|--------|---------|",
  ];
  for (const m of data) {
    const holdoutImpr =
      m.holdout_improvement_pct !== null
        ? `${m.holdout_improvement_pct.toFixed(1)}%`
        : "n/a";
    const rawMae =
      m.holdout_raw_mae !== null
        ? `${m.holdout_raw_mae.toFixed(3)}m`
        : "n/a";
    const corrMae =
      m.holdout_corrected_mae !== null
        ? `${m.holdout_corrected_mae.toFixed(3)}m`
        : "n/a";
    lines.push(
      `| ${m.version} | ${m.status} | ${holdoutImpr} | ${rawMae} | ${corrMae} | ${m.training_samples.toLocaleString()} | ${m.training_window_days}d | ${relativeTime(m.created_at)} |`
    );
  }
  return lines.join("\n");
}

function formatCorrectionStats(
  data: CorrectionStats | null,
  error: string | null
): string {
  if (error || !data) {
    return `### Correction Freshness\n\nWarning: ${error ?? "No data"}\n`;
  }

  const lines = [
    "### Correction Freshness",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Latest Correction | ${relativeTime(data.latest_corrected_at)} |`,
    `| Corrections (24h) | ${data.count_24h.toLocaleString()} |`,
    `| Total Corrections | ${data.total.toLocaleString()} |`,
  ];
  return lines.join("\n");
}

function formatPredictionStats(
  data: PredictionStats | null,
  error: string | null
): string {
  if (error || !data) {
    return `### Prediction Pipeline\n\nWarning: ${error ?? "No data"}\n`;
  }

  const lines = [
    "### Prediction Pipeline",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Latest Prediction | ${relativeTime(data.latest_predicted_at)} |`,
    `| Total Predictions | ${data.total.toLocaleString()} |`,
    "",
    "**Daily counts (last 10 days):**",
    "",
    "| Date | Count |",
    "|------|-------|",
  ];
  for (const d of data.daily_counts) {
    lines.push(`| ${d.day} | ${d.count.toLocaleString()} |`);
  }
  return lines.join("\n");
}

function formatRecordCounts(counts: Record<string, number> | undefined): string {
  if (!counts || Object.keys(counts).length === 0) return "none";
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function formatSessionWaveObservationAnalytics(
  data: SessionWaveObservationAnalytics | null,
  error: string | null
): string {
  if (error || !data) {
    return `### Session Wave Observation Analytics\n\nWarning: ${error ?? "No data"}\n`;
  }

  const funnel = data.funnel ?? {};
  const sessionTruth = data.session_truth ?? {};
  const quality = data.quality ?? {};
  const counts = data.candidate_counts ?? {};
  const userReliability = data.anonymous_user_reliability ?? [];
  const deltaBuckets = data.match_delta_buckets ?? [];

  const lines = [
    "### Session Wave Observation Analytics",
    "",
    "| Session Truth Diagnostic (90d) | Count |",
    "|--------------------------------|-------|",
    `| Raw Wave-Height Sessions | ${sessionTruth.wave_height_sessions_90d_raw ?? 0} |`,
    `| Non-Deleted Wave-Height Sessions | ${sessionTruth.wave_height_sessions_90d_non_deleted ?? 0} |`,
    `| Strict Real Wave-Height Sessions | ${sessionTruth.wave_height_sessions_90d_strict_real ?? 0} |`,
    `| Excluded by analytics_is_real_user | ${sessionTruth.wave_height_sessions_90d_excluded_by_analytics_flag ?? 0} |`,
    `| Mock/Test Diagnostic | ${sessionTruth.wave_height_sessions_90d_mock_or_test_diagnostic ?? 0} |`,
    `| Bot-Flagged Linked Events | ${sessionTruth.wave_height_sessions_90d_bot_flagged ?? 0} |`,
    `| Strict Real with Forecast Snapshot | ${sessionTruth.wave_height_sessions_90d_snapshot_linked ?? 0} |`,
    "",
    "| Funnel | Count |",
    "|--------|-------|",
    `| Real Completed Sessions | ${funnel.real_completed_sessions ?? 0} |`,
    `| Candidate Rows | ${funnel.candidate_rows ?? 0} |`,
    `| Valid Height Candidates | ${funnel.valid_height_candidates ?? 0} |`,
    `| Matched to ML (+/-6h) | ${funnel.matched_to_ml_within_6h ?? 0} |`,
    `| Matched with Buoy Truth | ${funnel.matched_with_buoy_truth ?? 0} |`,
    `| Candidate Sessions (7d) | ${funnel.candidate_sessions_7d ?? 0} |`,
    `| Candidate Sessions (30d) | ${funnel.candidate_sessions_30d ?? 0} |`,
    "",
    "| Quality Metric | Value |",
    "|----------------|-------|",
    `| User vs Buoy Avg Abs Error | ${formatMaybeNumber(quality.user_vs_buoy_abs_error_avg_m, 3, "m")} |`,
    `| User vs Buoy Median Abs Error | ${formatMaybeNumber(quality.user_vs_buoy_abs_error_median_m, 3, "m")} |`,
    `| User vs Buoy P75 Abs Error | ${formatMaybeNumber(quality.user_vs_buoy_abs_error_p75_m, 3, "m")} |`,
    `| User vs Buoy P90 Abs Error | ${formatMaybeNumber(quality.user_vs_buoy_abs_error_p90_m, 3, "m")} |`,
    `| User Signed Bias | ${formatMaybeNumber(quality.user_vs_buoy_signed_bias_avg_m, 3, "m")} |`,
    `| Display Avg Abs Error | ${formatMaybeNumber(quality.display_abs_error_avg_m, 3, "m")} |`,
    `| Raw OM Avg Abs Error | ${formatMaybeNumber(quality.raw_om_abs_error_avg_m, 3, "m")} |`,
    `| v5 Shadow Avg Abs Error | ${formatMaybeNumber(quality.v5_shadow_abs_error_avg_m, 3, "m")} |`,
    `| User Beats Display | ${quality.user_beats_display_count ?? 0} / ${quality.display_comparison_count ?? 0} |`,
    `| User Beats v5 Shadow | ${quality.user_beats_v5_shadow_count ?? 0} / ${quality.v5_shadow_comparison_count ?? 0} |`,
    `| Effective Weak-Label Mass | ${formatMaybeNumber(counts.effective_weak_label_mass, 1)} |`,
    `| Quality States | ${formatRecordCounts(counts.by_quality_state)} |`,
    `| Creation Sources | ${formatRecordCounts(counts.by_source_created_by)} |`,
  ];

  if (userReliability.length > 0) {
    lines.push(
      "",
      "**Anonymous user reliability:**",
      "",
      "| User | N | Median Error | P75 Error | Bias |",
      "|------|---|--------------|-----------|------|"
    );
    for (const row of userReliability.slice(0, 8)) {
      lines.push(
        `| user_${row.anonymous_user_rank} | ${row.comparisons} | ${formatMaybeNumber(row.median_abs_error_m, 3, "m")} | ${formatMaybeNumber(row.p75_abs_error_m, 3, "m")} | ${formatMaybeNumber(row.avg_signed_bias_m, 3, "m")} |`
      );
    }
  }

  if (deltaBuckets.length > 0) {
    lines.push(
      "",
      "**Match delta buckets:**",
      "",
      "| Bucket | Candidates | With Buoy Truth |",
      "|--------|------------|-----------------|"
    );
    for (const row of deltaBuckets) {
      lines.push(
        `| ${row.bucket} | ${row.candidates} | ${row.with_buoy_truth} |`
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch (e: unknown) {
    console.error(
      `Fatal: ${e instanceof Error ? e.message : "Failed to create Supabase client"}`
    );
    process.exit(1);
  }

  // Run all fetches in parallel
  const [
    healthResult,
    cronResult,
    pipelineResult,
    weeklyResult,
    registryResult,
    correctionResult,
    predictionResult,
    sessionWaveObservationResult,
  ] = await Promise.all([
    fetchHealthEndpoint(),
    fetchCronStatus(),
    fetchPipelineHealth(supabase),
    fetchWeeklyMetrics(supabase),
    fetchModelRegistry(supabase),
    fetchCorrectionStats(supabase),
    fetchPredictionStats(supabase),
    fetchSessionWaveObservationAnalytics(supabase),
  ]);

  // Detect anomalies
  const anomalies = detectAnomalies(
    healthResult.data,
    healthResult.error,
    cronResult.data,
    pipelineResult.data,
    registryResult.data,
    correctionResult.data,
    predictionResult.data
  );

  // Build markdown output
  const sections = [
    "## ML Pipeline Dashboard",
    "",
    formatHealthSection(healthResult.data, healthResult.error),
    "",
    formatCronSection(cronResult.data, cronResult.error),
    "",
    formatPipelineHealth(pipelineResult.data, pipelineResult.error),
    "",
    formatWeeklyMetrics(weeklyResult.data, weeklyResult.error),
    "",
    formatModelRegistry(registryResult.data, registryResult.error),
    "",
    formatPredictionStats(predictionResult.data, predictionResult.error),
    "",
    formatSessionWaveObservationAnalytics(
      sessionWaveObservationResult.data,
      sessionWaveObservationResult.error
    ),
    "",
    formatCorrectionStats(correctionResult.data, correctionResult.error),
    "",
    "### Anomaly Flags",
    "",
  ];

  if (anomalies.length === 0) {
    sections.push("No anomalies detected.");
  } else {
    for (const flag of anomalies) {
      sections.push(`- **WARNING:** ${flag}`);
    }
  }

  console.log(sections.join("\n"));
}

main().catch((err: unknown) => {
  console.error(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
});

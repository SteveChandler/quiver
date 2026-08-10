/**
 * Read-only follow-up to prove-alert-delivery-root-cause.ts.
 *
 * This copies the reference harness's production-scope filters and forward-
 * horizon replay, then adds score decomposition, condition distributions,
 * source provenance, and threshold sensitivity. It performs SELECTs only.
 *
 * Run:
 *   NODE_PATH="$PWD/scripts/research/stubs" \
 *   ALERTS_DELIVERY_ENABLED=true \
 *   node --import tsx scripts/research/analyze-alert-preset-canonical-disagreement.ts
 */

import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import { CAPS, resolveEntitlement } from "@/lib/alerts/entitlements";
import {
  selectFreshAlertWindow,
  type EnhancedForecastAlertRow,
} from "@/lib/alerts/revalidate-alert-window";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import type { AlertConditions, MatchingWindow } from "@/lib/alerts/types";
import { buildCanonicalDecisionFromAlertMatches } from "@/lib/recommendations/canonical-decision";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import type { Database, Json } from "@/types/database.generated";

loadEnv({ path: ".env.production.local" });

const DAY_MS = 24 * 60 * 60 * 1000;
const FORECAST_PAGE_SIZE = 1000;
const TEST_EMAIL_PATTERN = /(test|local|example)/i;
const CANDIDATE_GO_BARS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

type RuleRow = {
  id: string;
  user_id: string;
  beach_id: string;
  name: string;
  conditions: AlertConditions;
  notify_email: boolean;
  notify_push: boolean;
  preset_type: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  is_mock: boolean | null;
  deleted_at: string | null;
  home_beach_id: string | null;
  notif_forecast_alerts: boolean;
  experience_level: string | null;
};

type EntitlementRow = {
  user_id: string;
  is_pro: boolean | null;
  is_trialing: boolean | null;
  billing_issue: boolean | null;
  expires_at: string | null;
};

type BeachRow = {
  id: string;
  name: string;
  slug: string | null;
  timezone: string | null;
  lat: number;
  lon: number;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  aspect_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  break_type: string | null;
  skill_level: string | null;
};

type ForecastRow = EnhancedForecastAlertRow & {
  id?: string;
  data_source?: string | null;
  wind_source?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  raw_forecast?: Json | null;
};

type ScoreComponents = {
  swell_height_min_margin?: number;
  swell_period_min_margin?: number;
  wind_speed_max_margin?: number;
  tide_range_center_fit?: number;
  swell_height_range_center_fit?: number;
  wind_direction_binary?: number;
  tide_direction_binary?: number;
};

type MeasurementRecord = {
  rule_id: string;
  preset_type: string | null;
  user_key: string;
  beach_id: string;
  beach_name: string;
  evaluation_date: string;
  matched: boolean;
  conditions: AlertConditions;
  window_start: string | null;
  window_end: string | null;
  best_hour: string | null;
  best_score: number | null;
  canonical_utility_score: number | null;
  score_components: ScoreComponents | null;
  score_reconciliation_delta: number | null;
  conditions_snapshot: Record<string, unknown> | null;
  verdict: CanonicalSessionDecision["verdict"] | null;
  reason_code: CanonicalSessionDecision["reasonCode"] | null;
  decision_basis: CanonicalSessionDecision["decisionBasis"] | null;
  safety_eligible: boolean;
  safety_reasons: string[];
  forecast_source: string | null;
  wind_source: string | null;
  forecast_updated_at: string | null;
};

type LoadedEvidence = {
  activeRules: RuleRow[];
  profilesById: Map<string, ProfileRow>;
  beachesById: Map<string, BeachRow>;
  forecastRowsByBeachId: Map<string, ForecastRow[]>;
  exclusions: Record<string, number>;
  forecast: {
    rows: number;
    beaches: number;
    earliestForecastAt: string | null;
    latestForecastAt: string | null;
    newestWriteAt: string | null;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function stableUserKey(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function isRealProfile(profile: ProfileRow): boolean {
  if (profile.is_mock !== false) return false;
  if (profile.deleted_at !== null) return false;
  return profile.email === null || !TEST_EMAIL_PATTERN.test(profile.email);
}

function localDateAt(value: Date, timezone: string): string {
  return value.toLocaleDateString("en-CA", { timeZone: timezone });
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  while (cursor.getTime() <= endMs) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function latestTimestamp(
  current: string | null,
  candidate: unknown,
): string | null {
  if (typeof candidate !== "string") return current;
  const candidateMs = Date.parse(candidate);
  if (!Number.isFinite(candidateMs)) return current;
  if (current === null || candidateMs > Date.parse(current)) return candidate;
  return current;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await fn(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return results;
}

async function fetchForecastRowsForBeach(
  client: SupabaseClient<Database>,
  beachId: string,
  queryStart: string,
): Promise<ForecastRow[]> {
  const rows: ForecastRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .gte("forecast_at", queryStart)
      .order("forecast_at", { ascending: true })
      .range(offset, offset + FORECAST_PAGE_SIZE - 1);
    if (error) {
      throw new Error(
        `enhanced_forecasts read failed for ${beachId}: ${error.message}`,
      );
    }
    const page = (data ?? []) as unknown as ForecastRow[];
    rows.push(...page);
    if (page.length < FORECAST_PAGE_SIZE) break;
    offset += FORECAST_PAGE_SIZE;
  }
  return rows;
}

async function loadEvidence(
  client: SupabaseClient<Database>,
  snapshotAt: Date,
): Promise<LoadedEvidence> {
  const { data: allRuleData, error: rulesError } = await client
    .from("alert_rules")
    .select(
      "id,user_id,beach_id,name,conditions,notify_email,notify_push,preset_type,created_at",
    )
    .eq("enabled", true);
  if (rulesError)
    throw new Error(`alert_rules read failed: ${rulesError.message}`);

  const allRules = (allRuleData ?? []) as unknown as RuleRow[];
  const evaluatorRules = allRules.filter(
    (rule) => rule.preset_type !== "similarity_match",
  );
  const userIds = [...new Set(evaluatorRules.map((rule) => rule.user_id))];
  const [profilesResult, entitlementsResult] = await Promise.all([
    client
      .from("profiles")
      .select(
        "id,email,is_mock,deleted_at,home_beach_id,notif_forecast_alerts,experience_level",
      )
      .in("id", userIds),
    client
      .from("user_entitlements")
      .select("user_id,is_pro,is_trialing,billing_issue,expires_at")
      .in("user_id", userIds),
  ]);
  if (profilesResult.error) {
    throw new Error(`profiles read failed: ${profilesResult.error.message}`);
  }
  if (entitlementsResult.error) {
    throw new Error(
      `user_entitlements read failed: ${entitlementsResult.error.message}`,
    );
  }

  const allProfiles = (profilesResult.data ?? []) as unknown as ProfileRow[];
  const allProfilesById = new Map(
    allProfiles.map((profile) => [profile.id, profile]),
  );
  const profilesById = new Map(
    allProfiles.filter(isRealProfile).map((profile) => [profile.id, profile]),
  );
  const scopedRules = evaluatorRules.filter((rule) =>
    profilesById.has(rule.user_id),
  );
  const entitlementsByUserId = new Map(
    ((entitlementsResult.data ?? []) as unknown as EntitlementRow[]).map(
      (row) => [row.user_id, row],
    ),
  );

  const activeRules: RuleRow[] = [];
  let excludedAlertsDisabled = 0;
  let excludedByEntitlementCap = 0;
  const rulesByUser = new Map<string, RuleRow[]>();
  for (const rule of scopedRules) {
    const userRules = rulesByUser.get(rule.user_id) ?? [];
    userRules.push(rule);
    rulesByUser.set(rule.user_id, userRules);
  }
  for (const [userId, userRules] of rulesByUser) {
    const profile = profilesById.get(userId);
    if (!profile) continue;
    if (!profile.notif_forecast_alerts) {
      excludedAlertsDisabled += userRules.length;
      continue;
    }
    const tier = resolveEntitlement(userId, entitlementsByUserId.get(userId));
    const sorted = [...userRules].sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at) ||
        left.id.localeCompare(right.id),
    );
    activeRules.push(...sorted.slice(0, CAPS[tier].totalRules));
    excludedByEntitlementCap += Math.max(
      0,
      sorted.length - CAPS[tier].totalRules,
    );
  }

  const beachIds = new Set(activeRules.map((rule) => rule.beach_id));
  for (const rule of activeRules) {
    const homeBeachId = profilesById.get(rule.user_id)?.home_beach_id;
    if (homeBeachId) beachIds.add(homeBeachId);
  }
  const { data: beachData, error: beachesError } = await client
    .from("beaches")
    .select(
      "id,name,slug,timezone,lat,lon,wind_offshore_deg,wind_offshore_tol_deg,aspect_deg,preferred_tide_ft_min,preferred_tide_ft_max,preferred_tide_direction,swell_window_center_deg,swell_window_halfwidth_deg,break_type,skill_level",
    )
    .in("id", [...beachIds]);
  if (beachesError)
    throw new Error(`beaches read failed: ${beachesError.message}`);
  const beachesById = new Map(
    ((beachData ?? []) as unknown as BeachRow[]).map((beach) => [
      beach.id,
      beach,
    ]),
  );

  const forecastBeachIds = [
    ...new Set(activeRules.map((rule) => rule.beach_id)),
  ];
  const queryStart = new Date(snapshotAt.getTime() - DAY_MS).toISOString();
  const forecastResults = await mapWithConcurrency(
    forecastBeachIds,
    8,
    async (beachId) => ({
      beachId,
      rows: await fetchForecastRowsForBeach(client, beachId, queryStart),
    }),
  );
  const forecastRowsByBeachId = new Map(
    forecastResults.map(({ beachId, rows }) => [beachId, rows]),
  );
  const allForecastRows = forecastResults.flatMap(({ rows }) => rows);
  let earliestForecastAt: string | null = null;
  let latestForecastAt: string | null = null;
  let newestWriteAt: string | null = null;
  for (const row of allForecastRows) {
    const forecastMs = Date.parse(row.forecast_at);
    if (forecastMs >= snapshotAt.getTime()) {
      if (
        earliestForecastAt === null ||
        forecastMs < Date.parse(earliestForecastAt)
      ) {
        earliestForecastAt = row.forecast_at;
      }
      if (
        latestForecastAt === null ||
        forecastMs > Date.parse(latestForecastAt)
      ) {
        latestForecastAt = row.forecast_at;
      }
    }
    newestWriteAt = latestTimestamp(
      newestWriteAt,
      row.updated_at ?? row.created_at,
    );
  }

  return {
    activeRules,
    profilesById,
    beachesById,
    forecastRowsByBeachId,
    exclusions: {
      enabled_rules_all: allRules.length,
      similarity_match_separate_pipeline:
        allRules.length - evaluatorRules.length,
      missing_profile: evaluatorRules.filter(
        (rule) => !allProfilesById.has(rule.user_id),
      ).length,
      excluded_non_real_profile: evaluatorRules.filter((rule) => {
        const profile = allProfilesById.get(rule.user_id);
        return profile !== undefined && !isRealProfile(profile);
      }).length,
      profile_alerts_disabled: excludedAlertsDisabled,
      entitlement_cap: excludedByEntitlementCap,
      active_evaluator_rules: activeRules.length,
      active_evaluator_users: new Set(
        activeRules.map((rule) => rule.user_id).values(),
      ).size,
    },
    forecast: {
      rows: allForecastRows.length,
      beaches: forecastBeachIds.length,
      earliestForecastAt,
      latestForecastAt,
      newestWriteAt,
    },
  };
}

function canonicalUtilityScore(bestScore: number): number {
  return bestScore >= 0 && bestScore <= 1 ? bestScore * 100 : bestScore;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scoreComponents(
  conditions: AlertConditions,
  snapshot: Record<string, unknown>,
): ScoreComponents {
  const components: ScoreComponents = {};
  const waveHeight = finiteNumber(snapshot.wave_height);
  const swellPeriod =
    finiteNumber(snapshot.swell_1_period) ?? finiteNumber(snapshot.wave_period);
  const windSpeed = finiteNumber(snapshot.wind_speed);
  const tideHeight = finiteNumber(snapshot.tide_height);

  if (conditions.swell_height_min != null && waveHeight != null) {
    components.swell_height_min_margin =
      (waveHeight - conditions.swell_height_min) /
      Math.max(conditions.swell_height_min, 1);
  }
  if (conditions.swell_period_min != null && swellPeriod != null) {
    components.swell_period_min_margin =
      (swellPeriod - conditions.swell_period_min) /
      Math.max(conditions.swell_period_min, 1);
  }
  if (conditions.wind_speed_max_kt != null && windSpeed != null) {
    components.wind_speed_max_margin =
      (conditions.wind_speed_max_kt - windSpeed) /
      Math.max(conditions.wind_speed_max_kt, 1);
  }
  if (
    conditions.tide_height_min_ft != null &&
    conditions.tide_height_max_ft != null &&
    tideHeight != null
  ) {
    const center =
      (conditions.tide_height_min_ft + conditions.tide_height_max_ft) / 2;
    const halfWidth =
      (conditions.tide_height_max_ft - conditions.tide_height_min_ft) / 2;
    if (halfWidth > 0) {
      components.tide_range_center_fit =
        1 - Math.abs(tideHeight - center) / halfWidth;
    }
  }
  if (
    conditions.swell_height_min != null &&
    conditions.swell_height_max != null &&
    waveHeight != null
  ) {
    const center =
      (conditions.swell_height_min + conditions.swell_height_max) / 2;
    const halfWidth =
      (conditions.swell_height_max - conditions.swell_height_min) / 2;
    if (halfWidth > 0) {
      components.swell_height_range_center_fit =
        1 - Math.abs(waveHeight - center) / halfWidth;
    }
  }
  if (conditions.wind_direction != null) components.wind_direction_binary = 1;
  if (conditions.tide_direction != null) components.tide_direction_binary = 1;
  return components;
}

function averageComponents(components: ScoreComponents): number {
  const values = Object.values(components).filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildDecision(
  match: MatchingWindow,
  profileExperience: unknown,
  snapshotAt: Date,
): CanonicalSessionDecision {
  return buildCanonicalDecisionFromAlertMatches({
    anchorTime: snapshotAt.toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: match.window_start,
      windowEnd: match.window_end,
      timezone: match.beach_timezone,
    },
    profileExperience,
    recommendationAvailability: {
      state: "available",
      holdEpoch: `research:${snapshotAt.toISOString()}`,
      resolutionAsOf: snapshotAt.toISOString(),
    },
    matches: [match],
  });
}

function quantile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const value =
    lower === upper
      ? sorted[lower]
      : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  return Number(value.toFixed(3));
}

function numericDistribution(
  values: Array<number | null>,
): Record<string, number | null> {
  const present = values.filter((value): value is number => value !== null);
  return {
    n: present.length,
    missing: values.length - present.length,
    min: quantile(present, 0),
    p25: quantile(present, 0.25),
    median: quantile(present, 0.5),
    p75: quantile(present, 0.75),
    max: quantile(present, 1),
  };
}

function categoricalDistribution(values: unknown[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = value == null || value === "" ? "missing" : String(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    ),
  );
}

function scoreHistogram(records: MeasurementRecord[]): Record<string, number> {
  const bins: Record<string, number> = {
    "<0": 0,
    "0-9.999": 0,
    "10-19.999": 0,
    "20-29.999": 0,
    "30-39.999": 0,
    "40-49.999": 0,
    "50-59.999": 0,
    "60-69.999": 0,
    "70-79.999": 0,
    "80-89.999": 0,
    "90-100": 0,
    ">100": 0,
  };
  for (const record of records) {
    const score = record.canonical_utility_score;
    if (score === null) continue;
    if (score < 0) bins["<0"] += 1;
    else if (score < 10) bins["0-9.999"] += 1;
    else if (score < 20) bins["10-19.999"] += 1;
    else if (score < 30) bins["20-29.999"] += 1;
    else if (score < 40) bins["30-39.999"] += 1;
    else if (score < 50) bins["40-49.999"] += 1;
    else if (score < 60) bins["50-59.999"] += 1;
    else if (score < 70) bins["60-69.999"] += 1;
    else if (score < 80) bins["70-79.999"] += 1;
    else if (score < 90) bins["80-89.999"] += 1;
    else if (score <= 100) bins["90-100"] += 1;
    else bins[">100"] += 1;
  }
  return bins;
}

function dedupedVolume(records: MeasurementRecord[]): number {
  return new Set(
    records.map(
      (record) =>
        `${record.user_key}:${record.beach_id}:${record.evaluation_date}`,
    ),
  ).size;
}

function summarize(
  evidence: LoadedEvidence,
  records: MeasurementRecord[],
  snapshotAt: Date,
): Record<string, unknown> {
  const matched = records.filter((record) => record.matched);
  const safetyEligible = matched.filter((record) => record.safety_eligible);
  const safetyEligiblePresets = safetyEligible.filter(
    (record) => record.preset_type !== null,
  );
  const presetNames = [
    ...new Set(
      evidence.activeRules.map((rule) => rule.preset_type ?? "custom"),
    ),
  ].sort();
  const byPreset = Object.fromEntries(
    presetNames.map((preset) => {
      const group = matched.filter(
        (record) => (record.preset_type ?? "custom") === preset,
      );
      const eligible = group.filter((record) => record.safety_eligible);
      const selectedNo = eligible.filter((record) => record.verdict === "no");
      return [
        preset,
        {
          matches: group.length,
          safety_eligible: eligible.length,
          verdicts: categoricalDistribution(
            group.map((record) => record.verdict),
          ),
          safety_eligible_verdicts: categoricalDistribution(
            eligible.map((record) => record.verdict),
          ),
          canonical_score_distribution: numericDistribution(
            eligible.map((record) => record.canonical_utility_score),
          ),
          canonical_score_histogram: scoreHistogram(eligible),
          matched_but_selected_no_conditions: {
            n: selectedNo.length,
            wave_height_ft: numericDistribution(
              selectedNo.map((record) =>
                finiteNumber(record.conditions_snapshot?.wave_height),
              ),
            ),
            period_seconds: numericDistribution(
              selectedNo.map(
                (record) =>
                  finiteNumber(record.conditions_snapshot?.swell_1_period) ??
                  finiteNumber(record.conditions_snapshot?.wave_period),
              ),
            ),
            swell_direction_degrees: numericDistribution(
              selectedNo.map((record) =>
                finiteNumber(record.conditions_snapshot?.swell_1_direction),
              ),
            ),
            wind_speed_knots: numericDistribution(
              selectedNo.map((record) =>
                finiteNumber(record.conditions_snapshot?.wind_speed),
              ),
            ),
            wind_direction_degrees: numericDistribution(
              selectedNo.map((record) =>
                finiteNumber(record.conditions_snapshot?.wind_direction_deg),
              ),
            ),
            tide_height_ft: numericDistribution(
              selectedNo.map((record) =>
                finiteNumber(record.conditions_snapshot?.tide_height),
              ),
            ),
            tide_status: categoricalDistribution(
              selectedNo.map(
                (record) => record.conditions_snapshot?.tide_status,
              ),
            ),
          },
          forecast_sources: categoricalDistribution(
            eligible.map((record) => record.forecast_source),
          ),
          wind_sources: categoricalDistribution(
            eligible.map((record) => record.wind_source),
          ),
        },
      ];
    }),
  );

  const liveConditionVariants = Object.fromEntries(
    presetNames.map((preset) => {
      const rules = evidence.activeRules.filter(
        (rule) => (rule.preset_type ?? "custom") === preset,
      );
      const variants = new Map<string, number>();
      for (const rule of rules) {
        const serialized = JSON.stringify(
          rule.conditions,
          Object.keys(rule.conditions).sort(),
        );
        variants.set(serialized, (variants.get(serialized) ?? 0) + 1);
      }
      return [
        preset,
        [...variants.entries()]
          .map(([conditions, ruleCount]) => ({
            rule_count: ruleCount,
            conditions: JSON.parse(conditions) as AlertConditions,
          }))
          .sort((left, right) => right.rule_count - left.rule_count),
      ];
    }),
  );

  const sensitivity = CANDIDATE_GO_BARS.map((bar) => {
    const qualifying = safetyEligiblePresets.filter(
      (record) => (record.canonical_utility_score ?? -Infinity) >= bar,
    );
    const currentQualifying = safetyEligiblePresets.filter(
      (record) => (record.canonical_utility_score ?? -Infinity) >= 70,
    );
    const changed = new Set([
      ...qualifying.map(
        (record) => `${record.rule_id}:${record.evaluation_date}`,
      ),
      ...currentQualifying.map(
        (record) => `${record.rule_id}:${record.evaluation_date}`,
      ),
    ]);
    const qualifyingKeys = new Set(
      qualifying.map((record) => `${record.rule_id}:${record.evaluation_date}`),
    );
    const currentKeys = new Set(
      currentQualifying.map(
        (record) => `${record.rule_id}:${record.evaluation_date}`,
      ),
    );
    const changedFrom70 = [...changed].filter(
      (key) => qualifyingKeys.has(key) !== currentKeys.has(key),
    ).length;
    return {
      candidate_go_bar: bar,
      safety_eligible_preset_rule_windows: qualifying.length,
      changed_from_bar_70: changedFrom70,
      modeled_user_beach_day_alerts: dedupedVolume(qualifying),
      distinct_users: new Set(qualifying.map((record) => record.user_key)).size,
    };
  });

  const horizonDays = evidence.forecast.latestForecastAt
    ? (Date.parse(evidence.forecast.latestForecastAt) - snapshotAt.getTime()) /
      DAY_MS
    : 0;
  const scaleAnomalies = matched.filter(
    (record) => record.best_score !== null && record.best_score > 1,
  );

  return {
    snapshot_at: snapshotAt.toISOString(),
    method: {
      measured:
        "Live rule/profile/beach values and latest enhanced_forecasts rows read at snapshot_at; matcher, score, alert adapter, and canonical engine executed from the checked-out production code.",
      modeled:
        "The fixed forecast snapshot is replayed across future local dates; sensitivity changes only the alert qualification bar and deduplicates volume to user x beach x local date.",
      production_access:
        "Supabase SELECT requests only; no RPCs and no writes.",
    },
    scope: {
      ...evidence.exclusions,
      rule_day_records: records.length,
      matched_rule_windows: matched.length,
      safety_eligible_windows: safetyEligible.length,
      safety_eligible_preset_windows: safetyEligiblePresets.length,
    },
    forecast: {
      ...evidence.forecast,
      horizon_days: Number(horizonDays.toFixed(2)),
      freshness_hours:
        evidence.forecast.newestWriteAt === null
          ? null
          : Number(
              (
                (snapshotAt.getTime() -
                  Date.parse(evidence.forecast.newestWriteAt)) /
                3_600_000
              ).toFixed(2),
            ),
      all_matched_sources: categoricalDistribution(
        matched.map((record) => record.forecast_source),
      ),
      all_matched_wind_sources: categoricalDistribution(
        matched.map((record) => record.wind_source),
      ),
    },
    thresholds_from_code: {
      go: 70,
      maybe: 40,
      no: "<40",
      alert_adapter_mapping:
        "best_score in [0,1] => best_score * 100; otherwise unchanged",
    },
    score_scale_reconciliation: {
      maximum_absolute_component_average_delta: quantile(
        matched
          .map((record) => record.score_reconciliation_delta)
          .filter((value): value is number => value !== null),
        1,
      ),
      best_score_above_one_count: scaleAnomalies.length,
      best_score_above_one_examples: scaleAnomalies
        .slice(0, 10)
        .map((record) => ({
          preset_type: record.preset_type,
          best_score: record.best_score,
          canonical_utility_score: record.canonical_utility_score,
        })),
    },
    live_rule_condition_variants: liveConditionVariants,
    per_preset: byPreset,
    all_safety_eligible_preset_score_histogram: scoreHistogram(
      safetyEligiblePresets,
    ),
    sensitivity,
    caveats: [
      "Forecast rows are mutable; this is not time travel. Supplying an earlier snapshot time would not restore prior row values.",
      "The replay evaluates every visible future local date, while the live evaluator processes only the current local date on each run.",
      "A forecast window is evidence about forecast inputs, not observed surf quality; no cameras, buoys at session time, or surfer ratings validate these future sessions.",
      "This harness bypasses major-event hold resolution. The referenced 17:55 delivery measurement separately found every shortened hold candidate allowed.",
    ],
  };
}

async function measure(
  client: SupabaseClient<Database>,
  snapshotAt: Date,
): Promise<{ summary: Record<string, unknown>; records: MeasurementRecord[] }> {
  const evidence = await loadEvidence(client, snapshotAt);
  const records: MeasurementRecord[] = [];
  const latestForecastAt = evidence.forecast.latestForecastAt;
  if (!latestForecastAt)
    return { summary: summarize(evidence, records, snapshotAt), records };

  for (const rule of evidence.activeRules) {
    const profile = evidence.profilesById.get(rule.user_id);
    const beach = evidence.beachesById.get(rule.beach_id);
    if (!profile || !beach) continue;
    const homeTimezone = profile.home_beach_id
      ? (evidence.beachesById.get(profile.home_beach_id)?.timezone ??
        "America/New_York")
      : "America/New_York";
    const beachTimezone = beach.timezone ?? "America/Los_Angeles";
    const dates = enumerateDates(
      localDateAt(snapshotAt, homeTimezone),
      localDateAt(new Date(latestForecastAt), homeTimezone),
    );
    const beachRows = evidence.forecastRowsByBeachId.get(rule.beach_id) ?? [];
    for (const evaluationDate of dates) {
      const { start, end } = getUtcDayBounds(evaluationDate, beachTimezone);
      const dayRows = beachRows.filter((row) => {
        const forecastMs = Date.parse(row.forecast_at);
        return forecastMs >= Date.parse(start) && forecastMs < Date.parse(end);
      });
      const fresh = selectFreshAlertWindow({
        conditions: rule.conditions,
        forecastRows: dayRows,
        beach: {
          id: beach.id,
          name: beach.name,
          slug: beach.slug,
          timezone: beachTimezone,
          lat: beach.lat,
          lon: beach.lon,
          wind_offshore_deg: beach.wind_offshore_deg,
          wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
          aspect_deg: beach.aspect_deg,
          preferred_tide_ft_min: beach.preferred_tide_ft_min,
          preferred_tide_ft_max: beach.preferred_tide_ft_max,
          preferred_tide_direction: beach.preferred_tide_direction,
          swell_window_center_deg: beach.swell_window_center_deg,
          swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
          break_type: beach.break_type,
          skill_level: beach.skill_level,
        },
        now: snapshotAt,
      });

      const base: MeasurementRecord = {
        rule_id: rule.id,
        preset_type: rule.preset_type,
        user_key: stableUserKey(rule.user_id),
        beach_id: beach.id,
        beach_name: beach.name,
        evaluation_date: evaluationDate,
        matched: fresh !== null,
        conditions: rule.conditions,
        window_start: fresh?.window_start ?? null,
        window_end: fresh?.window_end ?? null,
        best_hour: fresh?.best_hour ?? null,
        best_score: fresh?.best_score ?? null,
        canonical_utility_score:
          fresh === null ? null : canonicalUtilityScore(fresh.best_score),
        score_components: null,
        score_reconciliation_delta: null,
        conditions_snapshot: fresh?.conditions_snapshot ?? null,
        verdict: null,
        reason_code: null,
        decision_basis: null,
        safety_eligible: false,
        safety_reasons: [],
        forecast_source: null,
        wind_source: null,
        forecast_updated_at: null,
      };
      records.push(base);
      if (!fresh) continue;

      const components = scoreComponents(
        rule.conditions,
        fresh.conditions_snapshot,
      );
      const matchedRow = dayRows.find(
        (row) => row.forecast_at === fresh.best_hour,
      );
      const match: MatchingWindow = {
        rule_id: rule.id,
        rule_name: rule.name,
        beach_id: beach.id,
        beach_name: beach.name,
        beach_slug: beach.slug,
        beach_skill_level: beach.skill_level,
        beach_timezone: beachTimezone,
        window_start: fresh.window_start,
        window_end: fresh.window_end,
        best_hour: fresh.best_hour,
        best_score: fresh.best_score,
        conditions_snapshot: fresh.conditions_snapshot,
        notify_email: rule.notify_email,
        notify_push: rule.notify_push,
      };
      const decision = buildDecision(
        match,
        profile.experience_level,
        snapshotAt,
      );
      base.score_components = components;
      base.score_reconciliation_delta = Number(
        Math.abs(averageComponents(components) - fresh.best_score).toFixed(12),
      );
      base.verdict = decision.verdict;
      base.reason_code = decision.reasonCode;
      base.decision_basis = decision.decisionBasis;
      base.safety_eligible = decision.skillEligibility.state === "eligible";
      base.safety_reasons = [...decision.skillEligibility.reasonCodes];
      base.forecast_source = matchedRow?.data_source ?? null;
      base.wind_source = matchedRow?.wind_source ?? null;
      base.forecast_updated_at =
        matchedRow?.updated_at ?? matchedRow?.created_at ?? null;
    }
  }

  return { summary: summarize(evidence, records, snapshotAt), records };
}

async function main(): Promise<void> {
  if (process.env.ALERTS_DELIVERY_ENABLED !== "true") {
    throw new Error(
      "Set ALERTS_DELIVERY_ENABLED=true to mirror production configuration",
    );
  }
  const snapshotAt = new Date();
  const client = createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await measure(client, snapshotAt);
  console.log(JSON.stringify(result.summary, null, 2));
  if (process.env.ALERT_CALIBRATION_INCLUDE_RECORDS === "true") {
    console.log("=== RECORDS ===");
    console.log(JSON.stringify(result.records, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});

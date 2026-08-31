import "server-only";

import { createContextLogger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase";
import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  formatDisplayHeightFt,
  parseDisplayHeightFt,
} from "./apply-beach-height-offset";
import { isTrustedForecastAdjustmentEnabled } from "./trusted-forecast-adjustment";
import { TRUSTED_FORECAST_POLICY_VERSION } from "./trusted-forecast-policy";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_DELTAS = new Set([-0.5, -0.25, 0.25, 0.5]);
const ROUTE_IDENTIFIER = "/api/forecasts/update-enhanced";
const MAX_PROJECTION_WRITE_SKEW_MS = 15 * 60 * 1000;

const log = createContextLogger("TrustedForecastServing");

interface ServingApplicationRow {
  readonly beach_id: string;
  readonly forecast_at: string;
  readonly applied_delta_ft: number;
  readonly original_baseline_max_face_ft: number;
  readonly original_adjusted_max_face_ft: number;
  readonly current_baseline_max_face_ft: number;
  readonly display_wave_height: string;
  readonly refreshed_at: string;
  readonly trusted_forecast_decisions: {
    readonly policy_version: string;
  };
}

export interface TrustedForecastServingStore {
  selectProjections(args: {
    readonly beachId: string;
    readonly forecastAts: readonly string[];
  }): Promise<{
    readonly data: unknown[] | null;
    readonly error: { readonly code?: string } | null;
  }>;
}

interface ServingEnv {
  readonly adjustmentsEnabled?: string;
  readonly servingEnabled?: string;
  readonly canaryUserIds?: string;
}

interface ApplyTrustedForecastServingArgs<T extends EnhancedForecastEntity> {
  readonly userId: string | null;
  readonly beachId: string;
  readonly forecasts: readonly T[];
  readonly store?: TrustedForecastServingStore;
  readonly env?: ServingEnv;
}

export function parseTrustedForecastCanaryUserIds(
  value = process.env.TRUSTED_FORECAST_CANARY_USER_IDS,
): readonly string[] | null {
  const ids = (value ?? "").split(",").map((id) => id.trim().toLowerCase());
  if (ids.length !== 2 || ids.some((id) => !UUID_RE.test(id))) return null;
  if (ids[0] === ids[1]) return null;
  return ids;
}

export function isTrustedForecastCanaryEligible(
  userId: string | null,
  servingEnabled = process.env.TRUSTED_FORECAST_CANARY_SERVING_ENABLED,
  canaryUserIds = process.env.TRUSTED_FORECAST_CANARY_USER_IDS,
  adjustmentsEnabled = process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED,
): boolean {
  if (
    !isTrustedForecastAdjustmentEnabled(adjustmentsEnabled) ||
    servingEnabled !== "true" ||
    userId === null ||
    !UUID_RE.test(userId)
  ) {
    return false;
  }
  const allowlist = parseTrustedForecastCanaryUserIds(canaryUserIds);
  return allowlist?.includes(userId.toLowerCase()) ?? false;
}

function createServingStore(): TrustedForecastServingStore {
  return {
    async selectProjections({ beachId, forecastAts }) {
      const { data, error } = await createServiceRoleClient()
        .from("trusted_forecast_serving_projections" as never)
        .select(
          "beach_id, forecast_at, display_wave_height, baseline_max_face_ft, refreshed_at, trusted_forecast_applications!trusted_forecast_serving_projections_application_fkey(applied_delta_ft, baseline_max_face_ft, adjusted_max_face_ft, trusted_forecast_decisions!trusted_forecast_applications_decision_id_fkey(policy_version))",
        )
        .eq("beach_id", beachId)
        .in("forecast_at", [...forecastAts]);
      return { data: data as unknown[] | null, error };
    },
  };
}

function parseApplication(value: unknown): ServingApplicationRow | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const application = row.trusted_forecast_applications;
  if (
    typeof application !== "object" ||
    application === null ||
    Array.isArray(application)
  ) {
    return null;
  }
  const applicationRow = application as Record<string, unknown>;
  const decision = applicationRow.trusted_forecast_decisions;
  if (typeof decision !== "object" || decision === null || Array.isArray(decision)) {
    return null;
  }
  const policyVersion = (decision as Record<string, unknown>).policy_version;
  if (
    (typeof applicationRow.applied_delta_ft !== "number" &&
      typeof applicationRow.applied_delta_ft !== "string") ||
    (typeof applicationRow.baseline_max_face_ft !== "number" &&
      typeof applicationRow.baseline_max_face_ft !== "string") ||
    (typeof applicationRow.adjusted_max_face_ft !== "number" &&
      typeof applicationRow.adjusted_max_face_ft !== "string") ||
    (typeof row.baseline_max_face_ft !== "number" &&
      typeof row.baseline_max_face_ft !== "string") ||
    typeof row.display_wave_height !== "string" ||
    typeof row.refreshed_at !== "string" ||
    applicationRow.applied_delta_ft === "" ||
    row.baseline_max_face_ft === "" ||
    applicationRow.baseline_max_face_ft === "" ||
    applicationRow.adjusted_max_face_ft === ""
  ) {
    return null;
  }
  const delta: number = Number(applicationRow.applied_delta_ft);
  const originalBaseline: number = Number(applicationRow.baseline_max_face_ft);
  const originalAdjusted: number = Number(applicationRow.adjusted_max_face_ft);
  const currentBaseline: number = Number(row.baseline_max_face_ft);
  if (
    typeof row.beach_id !== "string" ||
    typeof row.forecast_at !== "string" ||
    typeof policyVersion !== "string" ||
    !ALLOWED_DELTAS.has(delta) ||
    !Number.isFinite(originalBaseline) ||
    !Number.isFinite(originalAdjusted) ||
    !Number.isFinite(currentBaseline) ||
    originalBaseline < 0 ||
    originalAdjusted < 0 ||
    currentBaseline < 0 ||
    Math.abs(originalBaseline + delta - originalAdjusted) > 0.001
  ) {
    return null;
  }
  return {
    beach_id: row.beach_id,
    forecast_at: row.forecast_at,
    applied_delta_ft: delta,
    original_baseline_max_face_ft: originalBaseline,
    original_adjusted_max_face_ft: originalAdjusted,
    current_baseline_max_face_ft: currentBaseline,
    display_wave_height: row.display_wave_height,
    refreshed_at: row.refreshed_at,
    trusted_forecast_decisions: { policy_version: policyVersion },
  };
}

export async function applyTrustedForecastServing<
  T extends EnhancedForecastEntity,
>({
  userId,
  beachId,
  forecasts,
  store,
  env,
}: ApplyTrustedForecastServingArgs<T>): Promise<readonly T[]> {
  if (
    !isTrustedForecastCanaryEligible(
      userId,
      env?.servingEnabled,
      env?.canaryUserIds,
      env?.adjustmentsEnabled,
    ) ||
    forecasts.length === 0
  ) {
    return forecasts;
  }

  const baselineByInstant = new Map<
    string,
    { readonly index: number; readonly rangeSpread: number | null; readonly updatedAtMs: number }
  >();
  for (const [index, forecast] of forecasts.entries()) {
    if (forecast.beach_id !== beachId || typeof forecast.forecast_at !== "string") {
      return forecasts;
    }
    const at = new Date(forecast.forecast_at);
    const updatedAt = new Date(forecast.updated_at);
    const parsedHeight = parseDisplayHeightFt(forecast.wave_height);
    if (
      Number.isNaN(at.getTime()) ||
      Number.isNaN(updatedAt.getTime()) ||
      parsedHeight.numericFt === null
    ) return forecasts;
    const instant = at.toISOString();
    if (baselineByInstant.has(instant)) return forecasts;
    baselineByInstant.set(instant, {
      index,
      rangeSpread: parsedHeight.rangeSpread,
      updatedAtMs: updatedAt.getTime(),
    });
  }

  try {
    const result = await (store ?? createServingStore()).selectProjections({
      beachId,
      forecastAts: [...baselineByInstant.keys()],
    });
    if (result.error || !Array.isArray(result.data)) return forecasts;

    const applications = new Map<string, ServingApplicationRow>();
    for (const value of result.data) {
      const application = parseApplication(value);
      if (application === null || application.beach_id !== beachId) return forecasts;
      const at = new Date(application.forecast_at);
      if (Number.isNaN(at.getTime())) return forecasts;
      const instant = at.toISOString();
      const baseline = baselineByInstant.get(instant);
      const refreshedAtMs = new Date(application.refreshed_at).getTime();
      if (
        baseline === undefined ||
        Number.isNaN(refreshedAtMs) ||
        Math.abs(baseline.updatedAtMs - refreshedAtMs) >
          MAX_PROJECTION_WRITE_SKEW_MS ||
        applications.has(instant) ||
        forecasts[baseline.index]?.wave_height !== application.display_wave_height ||
        application.trusted_forecast_decisions.policy_version !==
          TRUSTED_FORECAST_POLICY_VERSION
      ) {
        return forecasts;
      }
      applications.set(instant, application);
    }
    if (applications.size === 0) return forecasts;

    const adjusted = forecasts.map((forecast) => ({ ...forecast }));
    for (const [instant, application] of applications) {
      const baseline = baselineByInstant.get(instant);
      if (baseline === undefined) return forecasts;
      adjusted[baseline.index].wave_height = formatDisplayHeightFt({
        numericFt:
          application.current_baseline_max_face_ft +
          application.applied_delta_ft,
        rangeSpread: baseline.rangeSpread,
      });
    }
    log.warn("trusted_forecast_canary_adjusted", {
      policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
      routeIdentifier: ROUTE_IDENTIFIER,
      adjustedSlotCount: applications.size,
    });
    return adjusted;
  } catch {
    return forecasts;
  }
}

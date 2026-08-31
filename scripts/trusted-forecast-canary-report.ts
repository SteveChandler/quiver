#!/usr/bin/env tsx

import { config } from "dotenv";

import { TRUSTED_FORECAST_POLICY_VERSION } from "../lib/services/forecast/trusted-forecast-policy";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_DELTAS = new Set([-0.5, -0.25, 0.25, 0.5]);
const MAX_PROJECTION_WRITE_SKEW_MS = 15 * 60 * 1000;

export interface CanaryApplicationRow {
  readonly beachId: string;
  readonly beach: string;
  readonly forecastAt: string;
  readonly baselineMaxFaceFt: number;
  readonly adjustedMaxFaceFt: number;
  readonly deltaFt: number;
  readonly policyVersion: string;
}

export interface CanaryBaselineRow {
  readonly beachId: string;
  readonly forecastAt: string;
  readonly waveHeight: string | null;
  readonly updatedAt: string;
}

export interface CanaryProjectionRow {
  readonly beachId: string;
  readonly forecastAt: string;
  readonly displayWaveHeight: string;
  readonly baselineMaxFaceFt: number;
  readonly refreshedAt: string;
}

export interface CanaryReportReader {
  selectApplications(from: string): Promise<readonly CanaryApplicationRow[]>;
  selectBaselines(args: {
    readonly beachIds: readonly string[];
    readonly forecastAts: readonly string[];
  }): Promise<readonly CanaryBaselineRow[]>;
  selectProjections(args: {
    readonly beachIds: readonly string[];
    readonly forecastAts: readonly string[];
  }): Promise<readonly CanaryProjectionRow[]>;
}

interface RunCanaryReportOptions {
  readonly reader: CanaryReportReader;
  readonly env?: { readonly canaryUserIds?: string };
  readonly now?: Date;
  readonly log?: (line: string) => void;
}

function parseExactlyTwoIds(value: string | undefined): readonly string[] | null {
  const ids = (value ?? "").split(",").map((id) => id.trim().toLowerCase());
  if (ids.length !== 2 || ids.some((id) => !UUID_RE.test(id))) return null;
  if (ids[0] === ids[1]) return null;
  return ids;
}

function key(beachId: string, forecastAt: string): string {
  return `${beachId}:${new Date(forecastAt).toISOString()}`;
}

export function loadIntegrityReportEnv(
  load: typeof config = config,
): void {
  load({ path: ".env.production.local" });
  load({ path: ".env.local" });
}

export async function runCanaryReport({
  reader,
  env = { canaryUserIds: process.env.TRUSTED_FORECAST_CANARY_USER_IDS },
  now = new Date(),
  log = console.log,
}: RunCanaryReportOptions): Promise<number> {
  const canaryIds = parseExactlyTwoIds(env.canaryUserIds);
  if (canaryIds === null) {
    log("ABORT invalid exactly-two canary configuration");
    return 1;
  }

  try {
    const applications = await reader.selectApplications(now.toISOString());
    const beachIds = [...new Set(applications.map((row) => row.beachId))];
    const lookup = {
      beachIds,
      forecastAts: applications.map((row) => row.forecastAt),
    };
    const [baselines, projections] = await Promise.all([
      reader.selectBaselines(lookup),
      reader.selectProjections(lookup),
    ]);
    const baselineBySlot = new Map<string, CanaryBaselineRow>();
    let duplicateBaselineCount = 0;
    for (const baseline of baselines) {
      const slotKey = key(baseline.beachId, baseline.forecastAt);
      if (baselineBySlot.has(slotKey)) duplicateBaselineCount += 1;
      baselineBySlot.set(slotKey, baseline);
    }
    const projectionBySlot = new Map<string, CanaryProjectionRow>();
    let duplicateProjectionCount = 0;
    for (const projection of projections) {
      const slotKey = key(projection.beachId, projection.forecastAt);
      if (projectionBySlot.has(slotKey)) duplicateProjectionCount += 1;
      projectionBySlot.set(slotKey, projection);
    }

    let integrityMismatchCount = duplicateBaselineCount + duplicateProjectionCount;
    let storedBaselineDeviationCount = 0;
    let unverifiableStoredBaselineCount = 0;
    const applicationSlots = new Set<string>();
    const slots = applications.map((application) => {
      const applicationKey = key(application.beachId, application.forecastAt);
      if (applicationSlots.has(applicationKey)) integrityMismatchCount += 1;
      applicationSlots.add(applicationKey);
      const baseline = baselineBySlot.get(applicationKey);
      const projection = projectionBySlot.get(applicationKey);
      const baselineStatus =
        baseline === undefined || projection === undefined
          ? "unverifiable"
          : baseline.waveHeight === projection.displayWaveHeight &&
              Math.abs(
                new Date(baseline.updatedAt).getTime() -
                  new Date(projection.refreshedAt).getTime(),
              ) <= MAX_PROJECTION_WRITE_SKEW_MS
            ? "match"
            : "deviation";
      if (baselineStatus === "deviation") storedBaselineDeviationCount += 1;
      if (baselineStatus === "unverifiable") unverifiableStoredBaselineCount += 1;
      const integrityMatches =
        baselineStatus === "match" &&
        projection !== undefined &&
        Number.isFinite(projection.baselineMaxFaceFt) &&
        projection.baselineMaxFaceFt >= 0 &&
        ALLOWED_DELTAS.has(application.deltaFt) &&
        Math.abs(
          application.baselineMaxFaceFt + application.deltaFt -
            application.adjustedMaxFaceFt,
        ) <= 0.001 &&
        application.policyVersion === TRUSTED_FORECAST_POLICY_VERSION;
      if (!integrityMatches) integrityMismatchCount += 1;
      return {
        beach: application.beach,
        forecastAt: new Date(application.forecastAt).toISOString(),
        policyVersion: application.policyVersion,
        deltaFt: application.deltaFt,
      };
    });

    const output = JSON.stringify(
      {
        reportType: "TRUSTED_FORECAST_INTEGRITY",
        canaryAccountCount: canaryIds.length,
        adjustedSlotCount: applications.length,
        baselineSlotCount: baselines.length,
        projectionSlotCount: projections.length,
        storedBaselineDeviationCount,
        unverifiableStoredBaselineCount,
        integrityMismatchCount,
        slots,
      },
      null,
      2,
    );
    log(canaryIds.reduce((text, id) => text.replaceAll(id, "[redacted]"), output));
    return integrityMismatchCount === 0 ? 0 : 1;
  } catch {
    log("ABORT read-only comparison failed");
    return 1;
  }
}

export function createProductionReader(): CanaryReportReader {
  return {
    async selectApplications(from) {
      const { createServiceRoleClient } = await import("../lib/supabase");
      const { data, error } = await createServiceRoleClient()
        .from("trusted_forecast_applications")
        .select(
          "beach_id, forecast_at, baseline_max_face_ft, adjusted_max_face_ft, applied_delta_ft, beaches!trusted_forecast_applications_beach_id_fkey(slug), trusted_forecast_decisions!trusted_forecast_applications_decision_id_fkey(policy_version)",
        )
        .gte("forecast_at", from)
        .order("forecast_at", { ascending: true });
      if (error) throw new Error(error.code ?? "application_read_failed");
      return (data ?? []).map((value) => {
        const row = value as unknown as Record<string, unknown>;
        const beach = row.beaches as { slug?: unknown } | null;
        const decision = row.trusted_forecast_decisions as
          | { policy_version?: unknown }
          | null;
        const baselineMaxFaceFt = Number(row.baseline_max_face_ft);
        const adjustedMaxFaceFt = Number(row.adjusted_max_face_ft);
        const deltaFt = Number(row.applied_delta_ft);
        if (
          typeof row.beach_id !== "string" ||
          typeof row.forecast_at !== "string" ||
          typeof beach?.slug !== "string" ||
          typeof decision?.policy_version !== "string" ||
          row.baseline_max_face_ft === null ||
          row.adjusted_max_face_ft === null ||
          row.applied_delta_ft === null ||
          !Number.isFinite(baselineMaxFaceFt) ||
          !Number.isFinite(adjustedMaxFaceFt) ||
          !Number.isFinite(deltaFt)
        ) {
          throw new Error("application_row_invalid");
        }
        return {
          beachId: row.beach_id,
          beach: beach.slug,
          forecastAt: row.forecast_at,
          baselineMaxFaceFt,
          adjustedMaxFaceFt,
          deltaFt,
          policyVersion: decision.policy_version,
        };
      });
    },
    async selectBaselines({ beachIds, forecastAts }) {
      if (beachIds.length === 0 || forecastAts.length === 0) return [];
      const { createServiceRoleClient } = await import("../lib/supabase");
      const { data, error } = await createServiceRoleClient()
        .from("enhanced_forecasts")
        .select("beach_id, forecast_at, wave_height, updated_at")
        .in("beach_id", [...beachIds])
        .in("forecast_at", [...new Set(forecastAts)])
        .order("forecast_at", { ascending: true });
      if (error) throw new Error(error.code ?? "baseline_read_failed");
      return (data ?? []).map((row) => ({
        beachId: row.beach_id,
        forecastAt: row.forecast_at,
        waveHeight: row.wave_height,
        updatedAt: row.updated_at,
      }));
    },
    async selectProjections({ beachIds, forecastAts }) {
      if (beachIds.length === 0 || forecastAts.length === 0) return [];
      const { createServiceRoleClient } = await import("../lib/supabase");
      const { data, error } = await createServiceRoleClient()
        .from("trusted_forecast_serving_projections" as never)
        .select("beach_id, forecast_at, display_wave_height, baseline_max_face_ft, refreshed_at")
        .in("beach_id", [...beachIds])
        .in("forecast_at", [...new Set(forecastAts)])
        .order("forecast_at", { ascending: true });
      if (error) throw new Error(error.code ?? "projection_read_failed");
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
        beachId: String(row.beach_id),
        forecastAt: String(row.forecast_at),
        displayWaveHeight: String(row.display_wave_height),
        baselineMaxFaceFt: Number(row.baseline_max_face_ft),
        refreshedAt: String(row.refreshed_at),
      }));
    },
  };
}

const isEntrypoint = process.argv[1]?.endsWith("trusted-forecast-canary-report.ts");
if (isEntrypoint) {
  loadIntegrityReportEnv();
  runCanaryReport({ reader: createProductionReader() }).then((code) => {
    process.exitCode = code;
  });
}

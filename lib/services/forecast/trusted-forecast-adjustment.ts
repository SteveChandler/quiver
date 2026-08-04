import { createHash } from "node:crypto";

import { createContextLogger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase";

const log = createContextLogger("TrustedForecastAdjustment");
const MAX_OFFSET_FT = 0.5;
const DEAD_BAND_FT = 0.5;
const OFFSET_STEP_FT = 0.25;
const CONFLICT_MIDPOINT_DELTA_FT = 1;
const DEFAULT_MAX_ISSUE_AGE_HOURS = 36;
const MAX_FUTURE_ISSUE_SKEW_MS = 5 * 60 * 1000;

export type TrustedExternalForecastRow = {
  id: string;
  provider: "wavecast" | "nws";
  source_scope: "spot" | "regional";
  source_key: string;
  beach_id: string;
  issued_at: string;
  valid_start: string;
  valid_end: string;
  min_face_ft: number;
  max_face_ft: number;
};

export type TrustedForecastSlot = {
  index: number;
  forecastAt: string;
  baselineHeightFt: number;
  rangeSpread: number | null;
};

export type TrustedForecastDecision = {
  decisionKey: string;
  trustedExternalForecastId: string;
  beachId: string;
  status: "applied" | "noop" | "conflict";
  validStart: string;
  validEnd: string;
  baselineMaxFt: number;
  trustedMinFaceFt: number;
  trustedMaxFaceFt: number;
  signedDistanceFt: number;
  offsetFt: number;
  evidenceIds: string[];
  slotIndexes: number[];
};

function maxIssueAgeHours(): number {
  const configured = Number(process.env.TRUSTED_FORECAST_MAX_ISSUE_AGE_HOURS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_ISSUE_AGE_HOURS;
}

export function isTrustedForecastAdjustmentEnabled(): boolean {
  return (
    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED?.trim().toLowerCase() !==
    "false"
  );
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validSourceRow(
  row: TrustedExternalForecastRow,
  now: Date,
): boolean {
  const issuedAtMs = Date.parse(row.issued_at);
  const validStartMs = Date.parse(row.valid_start);
  const validEndMs = Date.parse(row.valid_end);
  if (
    !Number.isFinite(issuedAtMs) ||
    !Number.isFinite(validStartMs) ||
    !Number.isFinite(validEndMs)
  ) {
    return false;
  }
  if (validEndMs <= validStartMs || validEndMs <= now.getTime()) return false;
  if (issuedAtMs > now.getTime() + MAX_FUTURE_ISSUE_SKEW_MS) return false;
  if (
    now.getTime() - issuedAtMs >
    maxIssueAgeHours() * 60 * 60 * 1000
  ) {
    return false;
  }
  if (
    !finiteNumber(row.min_face_ft) ||
    !finiteNumber(row.max_face_ft) ||
    row.min_face_ft < 0 ||
    row.max_face_ft > 50 ||
    row.max_face_ft < row.min_face_ft
  ) {
    return false;
  }
  return true;
}

function roundedBoundedOffset(signedDistanceFt: number): number {
  if (Math.abs(signedDistanceFt) < DEAD_BAND_FT) return 0;
  // A threshold-sized discrepancy gets the smaller 0.25 ft nudge; larger
  // misses scale to the 0.5 ft safety cap without jumping the full distance.
  const conservativeDistanceFt = signedDistanceFt / 2;
  const rounded =
    Math.round(conservativeDistanceFt / OFFSET_STEP_FT) * OFFSET_STEP_FT;
  return Math.max(-MAX_OFFSET_FT, Math.min(MAX_OFFSET_FT, rounded));
}

function decisionKey(args: {
  beachId: string;
  validStart: string;
  validEnd: string;
  evidenceIds: string[];
}): string {
  const value = [
    args.beachId,
    args.validStart,
    args.validEnd,
    ...[...args.evidenceIds].sort(),
  ].join("|");
  return createHash("sha256").update(value).digest("hex");
}

function authoritativeRowsForWindow(
  rows: TrustedExternalForecastRow[],
): TrustedExternalForecastRow[] {
  const byProvider = new Map<string, TrustedExternalForecastRow[]>();
  for (const row of rows) {
    const existing = byProvider.get(row.provider) ?? [];
    existing.push(row);
    byProvider.set(row.provider, existing);
  }

  const selected: TrustedExternalForecastRow[] = [];
  for (const providerRows of byProvider.values()) {
    const spotRows = providerRows.filter((row) => row.source_scope === "spot");
    const preferredRows = spotRows.length > 0 ? spotRows : providerRows;
    const latestIssuedAtMs = Math.max(
      ...preferredRows.map((row) => Date.parse(row.issued_at)),
    );
    selected.push(
      ...preferredRows.filter(
        (row) => Date.parse(row.issued_at) === latestIssuedAtMs,
      ),
    );
  }
  return selected;
}

export function buildTrustedForecastDecisions(args: {
  beachId: string;
  sources: TrustedExternalForecastRow[];
  slots: TrustedForecastSlot[];
  now?: Date;
}): TrustedForecastDecision[] {
  const now = args.now ?? new Date();
  if (!isTrustedForecastAdjustmentEnabled()) return [];

  const grouped = new Map<string, TrustedExternalForecastRow[]>();
  const sourceRows = Array.isArray(args.sources) ? args.sources : [];
  for (const row of sourceRows) {
    if (row.beach_id !== args.beachId || !validSourceRow(row, now)) continue;
    const key = `${row.valid_start}|${row.valid_end}`;
    const rows = grouped.get(key) ?? [];
    rows.push(row);
    grouped.set(key, rows);
  }

  const decisions: TrustedForecastDecision[] = [];
  for (const rowsForWindow of grouped.values()) {
    const sources = authoritativeRowsForWindow(rowsForWindow);
    if (sources.length === 0) continue;

    const validStart = sources[0].valid_start;
    const validEnd = sources[0].valid_end;
    const validStartMs = Date.parse(validStart);
    const validEndMs = Date.parse(validEnd);
    const slots = args.slots.filter((slot) => {
      const forecastAtMs = Date.parse(slot.forecastAt);
      return forecastAtMs >= validStartMs && forecastAtMs < validEndMs;
    });
    if (slots.length === 0) continue;

    const baselineMaxFt = Math.max(
      ...slots.map((slot) => slot.baselineHeightFt),
    );
    const midpoints = sources.map(
      (source) => (source.min_face_ft + source.max_face_ft) / 2,
    );
    const conflict =
      Math.max(...midpoints) - Math.min(...midpoints) >
      CONFLICT_MIDPOINT_DELTA_FT;
    const trustedMinFaceFt = Math.min(
      ...sources.map((source) => source.min_face_ft),
    );
    const trustedMaxFaceFt = Math.max(
      ...sources.map((source) => source.max_face_ft),
    );
    const signedDistanceFt =
      baselineMaxFt < trustedMinFaceFt
        ? baselineMaxFt - trustedMinFaceFt
        : baselineMaxFt > trustedMaxFaceFt
          ? baselineMaxFt - trustedMaxFaceFt
          : 0;
    const offsetFt = conflict
      ? 0
      : roundedBoundedOffset(signedDistanceFt);
    const evidenceIds = sources.map((source) => source.id).sort();
    const primary = [...sources].sort((left, right) => {
      if (left.source_scope !== right.source_scope) {
        return left.source_scope === "spot" ? -1 : 1;
      }
      if (left.provider !== right.provider) {
        return left.provider === "wavecast" ? -1 : 1;
      }
      return left.id.localeCompare(right.id);
    })[0];

    decisions.push({
      decisionKey: decisionKey({
        beachId: args.beachId,
        validStart,
        validEnd,
        evidenceIds,
      }),
      trustedExternalForecastId: primary.id,
      beachId: args.beachId,
      status: conflict ? "conflict" : offsetFt === 0 ? "noop" : "applied",
      validStart,
      validEnd,
      baselineMaxFt,
      trustedMinFaceFt,
      trustedMaxFaceFt,
      signedDistanceFt,
      offsetFt,
      evidenceIds,
      slotIndexes: slots.map((slot) => slot.index),
    });
  }

  return decisions.sort((left, right) =>
    left.validStart.localeCompare(right.validStart),
  );
}

export async function loadTrustedExternalForecastsForBeach(
  beachId: string,
  now: Date = new Date(),
): Promise<TrustedExternalForecastRow[]> {
  if (!isTrustedForecastAdjustmentEnabled()) return [];

  try {
    const cutoff = new Date(
      now.getTime() - maxIssueAgeHours() * 60 * 60 * 1000,
    );
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("trusted_external_forecasts" as never)
      .select(
        "id,provider,source_scope,source_key,beach_id,issued_at,valid_start,valid_end,min_face_ft,max_face_ft",
      )
      .eq("beach_id", beachId)
      .gte("issued_at", cutoff.toISOString())
      .gt("valid_end", now.toISOString())
      .order("valid_start", { ascending: true });

    if (error) {
      log.warn("trusted forecast lookup failed", {
        beachId,
        error: error.message,
        code: error.code,
      });
      return [];
    }
    if (!Array.isArray(data)) {
      return [];
    }
    return data as unknown as TrustedExternalForecastRow[];
  } catch (error) {
    log.warn("trusted forecast lookup failed", {
      beachId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function persistTrustedForecastDecisions(
  decisions: TrustedForecastDecision[],
): Promise<boolean> {
  if (decisions.length === 0) return true;

  try {
    const supabase = createServiceRoleClient();
    const payload = decisions.map((decision) => ({
      decision_key: decision.decisionKey,
      trusted_external_forecast_id: decision.trustedExternalForecastId,
      beach_id: decision.beachId,
      status: decision.status,
      valid_start: decision.validStart,
      valid_end: decision.validEnd,
      baseline_max_ft: Number(decision.baselineMaxFt.toFixed(2)),
      trusted_min_face_ft: Number(decision.trustedMinFaceFt.toFixed(2)),
      trusted_max_face_ft: Number(decision.trustedMaxFaceFt.toFixed(2)),
      signed_distance_ft: Number(decision.signedDistanceFt.toFixed(2)),
      offset_ft: decision.offsetFt,
      evidence_ids: decision.evidenceIds,
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("trusted_forecast_adjustments" as never)
      .upsert(payload as never, { onConflict: "decision_key" });

    if (error) {
      log.warn("trusted forecast decision persistence failed", {
        decisionCount: decisions.length,
        error: error.message,
        code: error.code,
      });
      return false;
    }
    for (const decision of decisions) {
      if (decision.status === "conflict") {
        log.warn("trusted_forecast_conflict", {
          beachId: decision.beachId,
          decisionKey: decision.decisionKey,
          validStart: decision.validStart,
          validEnd: decision.validEnd,
          evidenceCount: decision.evidenceIds.length,
        });
      } else if (decision.status === "applied") {
        log.info("trusted_forecast_adjustment_persisted", {
          beachId: decision.beachId,
          decisionKey: decision.decisionKey,
          validStart: decision.validStart,
          validEnd: decision.validEnd,
          offsetFt: decision.offsetFt,
          direction: decision.offsetFt < 0 ? "raise" : "lower",
        });
      }
    }
    return true;
  } catch (error) {
    log.warn("trusted forecast decision persistence failed", {
      decisionCount: decisions.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

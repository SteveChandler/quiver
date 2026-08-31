/**
 * Pure local-day trusted-forecast decision engine (Phase 21, MFA-04 / MFA-05).
 *
 * Implements D-09 through D-16 over already-validated private issues. It never
 * touches the database, never builds a public DTO and never logs source
 * content; the caller persists the returned payloads through the single
 * `persist_trusted_forecast_build` RPC created by 21-02.
 */

import {
  TRUSTED_FORECAST_POLICY_VERSION,
  dayPartsOverlap,
  selectTrustedForecastAuthority,
  type TrustedForecastCoverageEntry,
  type TrustedForecastDayPart,
  type TrustedForecastIssue,
  type TrustedForecastPrecedenceTier,
  type TrustedForecastValidityBasis,
} from "./trusted-forecast-policy";

/** D-16: raw elapsed-hour eligibility window, inclusive at both ends. */
export const TRUSTED_FORECAST_MIN_HORIZON_HOURS = 0;
export const TRUSTED_FORECAST_MAX_HORIZON_HOURS = 168;

/** D-11: independent nearest-edge separation strictly above this blocks. */
export const TRUSTED_FORECAST_CONFLICT_THRESHOLD_FT = 1.0;

/** D-15: no-op below this magnitude. */
export const TRUSTED_FORECAST_MIN_ADJUSTMENT_GAP_FT = 0.5;
/** D-15: at or above this magnitude the full half-foot band applies. */
export const TRUSTED_FORECAST_FULL_BAND_GAP_FT = 0.75;
/** D-15: hard cap in both directions. */
export const TRUSTED_FORECAST_MAX_ADJUSTMENT_FT = 0.5;

/** Separate immutable snapshot variant for a value served after trust adjustment. */
export const TRUSTED_FORECAST_ADJUSTED_DISPLAY_SOURCE =
  "trusted-forecast-adjusted-v1";

export const TRUSTED_FORECAST_ALERT_RANGE_SEPARATION =
  "range_separation_exceeded";

export type TrustedForecastDecisionStatus =
  | "applied"
  | "no_adjustment"
  | "no_authority"
  | "blocked_conflict";

/**
 * One Quiver forecast slot after base face transform, handoff blend and beach
 * offset (D-14). `baselineMaxFaceFt` is the display height this slot would
 * serve without any trusted adjustment.
 */
export interface TrustedForecastSlot {
  readonly forecastAt: Date;
  /** Raw, unrounded elapsed hours from the build anchor (D-16). */
  readonly forecastHorizonHours: number;
  readonly baselineMaxFaceFt: number | null;
  /** Snapshot dimensions selected by the builder for the same served slot. */
  readonly forecastHorizonBucket?: string;
  readonly displaySource?: string;
}

/** Durable `(beach_id, local_date)` decision already stored (D-13, D-18). */
export interface ExistingTrustedForecastDecision {
  readonly decisionId: string;
  readonly beachId: string;
  readonly localDate: string;
  readonly appliedDeltaFt: number;
  readonly status: TrustedForecastDecisionStatus;
}

/** Keys match the `decisions` element contract of `persist_trusted_forecast_build`. */
export interface TrustedForecastDecisionPayload {
  readonly beachId: string;
  readonly localDate: string;
  readonly localTimezone: string;
  readonly status: TrustedForecastDecisionStatus;
  readonly primaryIssueId: string | null;
  readonly baselineMaxFaceFt: number | null;
  readonly trustedMinFaceFt: number | null;
  readonly trustedMaxFaceFt: number | null;
  readonly signedGapFt: number | null;
  readonly appliedDeltaFt: number;
}

/** Keys match the `applications` element contract of the same RPC. */
export interface TrustedForecastApplicationPayload {
  readonly beachId: string;
  readonly localDate: string;
  readonly forecastAt: string;
  /** Full first-write snapshot key used by ml_predictions_log. */
  readonly forecastHorizonBucket: string;
  readonly displaySource: string;
  readonly appliedDeltaFt: number;
  readonly baselineMaxFaceFt: number | null;
  readonly adjustedMaxFaceFt: number | null;
}

/** Keys match the `alerts` element contract of the same RPC. */
export interface TrustedForecastAlertPayload {
  readonly beachId: string;
  readonly localDate: string;
  readonly alertCode: typeof TRUSTED_FORECAST_ALERT_RANGE_SEPARATION;
  readonly separationFt: number;
  readonly primaryIssueId: string | null;
  readonly conflictingIssueId: string | null;
  readonly evidence: TrustedForecastAlertEvidence;
}

/** Private operational evidence only — never source narrative, URL or hash. */
export interface TrustedForecastAlertEvidence {
  readonly policyVersion: string;
  readonly primaryTier: TrustedForecastPrecedenceTier;
  readonly primaryLineage: string;
  readonly primaryDayPart: TrustedForecastDayPart;
  readonly primaryValidityBasis: TrustedForecastValidityBasis;
  readonly primaryMinFaceFt: number;
  readonly primaryMaxFaceFt: number;
  readonly conflictingLineage: string;
  readonly conflictingDayPart: TrustedForecastDayPart;
  readonly conflictingValidityBasis: TrustedForecastValidityBasis;
  readonly conflictingMinFaceFt: number;
  readonly conflictingMaxFaceFt: number;
}

export interface ReusedTrustedForecastDecision {
  readonly decisionId: string;
  readonly beachId: string;
  readonly localDate: string;
  readonly appliedDeltaFt: number;
  readonly status: TrustedForecastDecisionStatus;
  /** ISO instants of the eligible slots this durable decision governs. */
  readonly governedForecastAts: readonly string[];
}

export interface TrustedForecastEngineResult {
  readonly policyVersion: string;
  readonly decisions: readonly TrustedForecastDecisionPayload[];
  readonly applications: readonly TrustedForecastApplicationPayload[];
  readonly alerts: readonly TrustedForecastAlertPayload[];
  readonly reusedDecisions: readonly ReusedTrustedForecastDecision[];
}

export interface BuildTrustedForecastDecisionsArgs {
  readonly coverage: TrustedForecastCoverageEntry;
  readonly issues: readonly TrustedForecastIssue[];
  readonly slots: readonly TrustedForecastSlot[];
  readonly buildAnchorAt: Date;
  readonly existingDecisions?: readonly ExistingTrustedForecastDecision[];
}

const EMPTY_RESULT: TrustedForecastEngineResult = Object.freeze({
  policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
  decisions: [],
  applications: [],
  alerts: [],
  reusedDecisions: [],
});

/** D-24: an unset flag keeps the deliberately enabled serving default. */
export function isTrustedForecastAdjustmentEnabled(
  raw = process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED,
): boolean {
  if (raw === undefined) return true;

  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes" || value === "on") {
    return true;
  }
  if (
    value === "" ||
    value === "false" ||
    value === "0" ||
    value === "no" ||
    value === "off"
  ) {
    return false;
  }

  console.error("trusted_forecast_adjustments_invalid_flag", {
    value: raw,
    serving: "disabled",
  });
  return false;
}

/** Matches `numeric(8, 4)` storage so float noise cannot cross a band edge. */
function roundFt(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

const LOCAL_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/**
 * The beach's IANA local calendar date for an instant. Never derived from a
 * fixed UTC window: a spring-forward day is 23 hours and a fall-back day is 25.
 */
export function localDateInTimeZone(instant: Date, timeZone: string): string {
  let formatter = LOCAL_DATE_FORMATTERS.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    LOCAL_DATE_FORMATTERS.set(timeZone, formatter);
  }
  return formatter.format(instant);
}

const LOCAL_HOUR_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/**
 * The beach's local clock hour for an instant, 0-23.
 *
 * Used only to place a slot inside a stated day part; the local *date* still
 * comes from `localDateInTimeZone`, so DST-length days are unaffected.
 */
function localHourInTimeZone(instant: Date, timeZone: string): number {
  let formatter = LOCAL_HOUR_FORMATTERS.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    });
    LOCAL_HOUR_FORMATTERS.set(timeZone, formatter);
  }
  // "24" is the en-GB midnight rendering under hour12:false.
  return Number(formatter.format(instant)) % 24;
}

/**
 * Which stated day part a slot falls in, using the NWS public-forecast
 * convention 21-01 stamps on `valid_start_at`/`valid_end_at`: day is
 * 06:00-18:00 local, night is 18:00-06:00.
 */
export function slotDayPart(
  instant: Date,
  timeZone: string,
): Exclude<TrustedForecastDayPart, "all_day"> {
  const hour = localHourInTimeZone(instant, timeZone);
  return hour >= 6 && hour < 18 ? "day" : "night";
}

/**
 * D-17/D-14 pairing correction (21-03 critic ruling 2).
 *
 * `day_part` gated conflict eligibility but not application, so a `day`-only
 * primary applied its delta to every night slot of the local day while a
 * disjoint `night` row from another lineage stayed exempt from the conflict
 * check — the engine ignored the night disagreement AND adjusted night slots
 * with a day-only call. The exemption is correct on its own terms (NWS states
 * "Today 2-4 ft" and "Tonight 8-12 ft" as two windows, not a 6-foot
 * disagreement), so the application side is what is restricted here: a primary
 * may only move the part of the day it actually spoke about.
 *
 * The comparison basis is deliberately unchanged — the trusted and Quiver
 * maxima are both still taken across the whole local day, which is the rule the
 * critic accepted; only its pairing with unrestricted application was rejected.
 */
export function slotIsInPrimaryDayPart(
  slot: TrustedForecastSlot,
  primaryDayPart: TrustedForecastDayPart,
  timeZone: string,
): boolean {
  if (primaryDayPart === "all_day") return true;
  return slotDayPart(slot.forecastAt, timeZone) === primaryDayPart;
}

/** D-16: raw hours, compared before any rounding. 0 and 168 are eligible. */
export function isEligibleHorizon(forecastHorizonHours: number): boolean {
  return (
    Number.isFinite(forecastHorizonHours) &&
    forecastHorizonHours >= TRUSTED_FORECAST_MIN_HORIZON_HOURS &&
    forecastHorizonHours <= TRUSTED_FORECAST_MAX_HORIZON_HOURS
  );
}

/**
 * D-11 nearest-edge separation between two ranges. Overlapping or touching
 * ranges separate by zero; never a midpoint distance.
 */
export function nearestEdgeSeparationFt(
  left: { readonly minFt: number; readonly maxFt: number },
  right: { readonly minFt: number; readonly maxFt: number },
): number {
  if (right.minFt > left.maxFt) return roundFt(right.minFt - left.maxFt);
  if (left.minFt > right.maxFt) return roundFt(left.minFt - right.maxFt);
  return 0;
}

/**
 * D-14: signed distance from the baseline to the nearest edge of the trusted
 * range. Inside the range is zero. Positive means the trusted call is bigger.
 */
export function signedGapFt(
  baselineMaxFt: number,
  trustedMinFt: number,
  trustedMaxFt: number,
): number {
  if (baselineMaxFt < trustedMinFt) return roundFt(trustedMinFt - baselineMaxFt);
  if (baselineMaxFt > trustedMaxFt) return roundFt(trustedMaxFt - baselineMaxFt);
  return 0;
}

/**
 * D-15: exact signed bands with addition semantics. Adding the result to the
 * baseline moves it toward the trusted range.
 */
export function appliedDeltaFtForGap(gapFt: number): number {
  const magnitudeFt = roundFt(Math.abs(gapFt));
  if (magnitudeFt < TRUSTED_FORECAST_MIN_ADJUSTMENT_GAP_FT) return 0;
  const sign = gapFt < 0 ? -1 : 1;
  const magnitude =
    magnitudeFt < TRUSTED_FORECAST_FULL_BAND_GAP_FT
      ? 0.25
      : TRUSTED_FORECAST_MAX_ADJUSTMENT_FT;
  return sign * magnitude;
}

interface LocalDayGroup {
  readonly localDate: string;
  readonly slots: TrustedForecastSlot[];
}

function groupSlotsByLocalDate(
  slots: readonly TrustedForecastSlot[],
  timeZone: string,
): LocalDayGroup[] {
  const byDate = new Map<string, TrustedForecastSlot[]>();
  const claimed = new Set<number>();

  for (const slot of slots) {
    if (!isEligibleHorizon(slot.forecastHorizonHours)) continue;
    const at = slot.forecastAt.getTime();
    if (!Number.isFinite(at)) continue;
    // D-13: a slot is claimed by at most one decision, so a repeated
    // `forecast_at` contributes once.
    if (claimed.has(at)) continue;
    claimed.add(at);

    const localDate = localDateInTimeZone(slot.forecastAt, timeZone);
    const bucket = byDate.get(localDate);
    if (bucket === undefined) byDate.set(localDate, [slot]);
    else bucket.push(slot);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([localDate, daySlots]) => ({
      localDate,
      slots: daySlots.sort(
        (left, right) => left.forecastAt.getTime() - right.forecastAt.getTime(),
      ),
    }));
}

function nextLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const wallClockMs = Date.UTC(
    values.get("year") ?? 0,
    (values.get("month") ?? 1) - 1,
    values.get("day") ?? 1,
    values.get("hour") ?? 0,
    values.get("minute") ?? 0,
    values.get("second") ?? 0,
  );
  return wallClockMs - instant.getTime();
}

function localMidnight(localDate: string, timeZone: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  let guessMs = Date.UTC(year, month - 1, day);
  // A second pass observes a DST offset change at the boundary.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    guessMs =
      Date.UTC(year, month - 1, day) -
      timeZoneOffsetMs(new Date(guessMs), timeZone);
  }
  return new Date(guessMs);
}

/**
 * A durable day decision must not be based on a trailing partial edge of the
 * 168-hour window. The current local day is allowed because every slot still
 * ahead of the build anchor is in the build's serving scope; otherwise a cold
 * start would permanently miss that day's remaining slots.
 */
export function isLocalDateFullyCoveredByBuildWindow(args: {
  readonly localDate: string;
  readonly timeZone: string;
  readonly buildAnchorAt: Date;
}): boolean {
  const dayStart = localMidnight(args.localDate, args.timeZone).getTime();
  const dayEnd = localMidnight(
    nextLocalDate(args.localDate),
    args.timeZone,
  ).getTime();
  const windowEnd =
    args.buildAnchorAt.getTime() + TRUSTED_FORECAST_MAX_HORIZON_HOURS * 3_600_000;
  const anchorLocalDate = localDateInTimeZone(args.buildAnchorAt, args.timeZone);
  return (
    dayEnd <= windowEnd &&
    (dayStart >= args.buildAnchorAt.getTime() ||
      args.localDate === anchorLocalDate)
  );
}

function localDayBaselineMaxFt(slots: readonly TrustedForecastSlot[]): number | null {
  let max: number | null = null;
  for (const slot of slots) {
    const baseline = slot.baselineMaxFaceFt;
    if (baseline === null || !Number.isFinite(baseline)) continue;
    if (max === null || baseline > max) max = baseline;
  }
  return max === null ? null : roundFt(max);
}

/**
 * Build every local-day decision for one beach.
 *
 * Deterministic and side-effect free: the same inputs always produce the same
 * ordered payloads, which is what makes the 21-02 build receipt's exact-count
 * replay meaningful.
 */
export function buildTrustedForecastDecisions(
  args: BuildTrustedForecastDecisionsArgs,
): TrustedForecastEngineResult {
  if (!isTrustedForecastAdjustmentEnabled()) return EMPTY_RESULT;

  const { coverage, issues, slots, buildAnchorAt } = args;
  const timeZone = coverage.localTimezone;

  const existingByDate = new Map<string, ExistingTrustedForecastDecision>();
  for (const existing of args.existingDecisions ?? []) {
    if (existing.beachId !== coverage.beachId) continue;
    if (!existingByDate.has(existing.localDate)) {
      existingByDate.set(existing.localDate, existing);
    }
  }

  const decisions: TrustedForecastDecisionPayload[] = [];
  const applications: TrustedForecastApplicationPayload[] = [];
  const alerts: TrustedForecastAlertPayload[] = [];
  const reusedDecisions: ReusedTrustedForecastDecision[] = [];

  for (const group of groupSlotsByLocalDate(slots, timeZone)) {
    const { localDate } = group;

    // D-13/D-18: a durable decision for this beach/local day is reused exactly.
    // Recomputation never supersedes it and never emits a second row.
    const existing = existingByDate.get(localDate);
    if (existing !== undefined) {
      reusedDecisions.push({
        decisionId: existing.decisionId,
        beachId: existing.beachId,
        localDate: existing.localDate,
        appliedDeltaFt: existing.appliedDeltaFt,
        status: existing.status,
        governedForecastAts: group.slots.map((slot) =>
          slot.forecastAt.toISOString(),
        ),
      });
      continue;
    }

    const baselineMaxFaceFt = localDayBaselineMaxFt(group.slots);
    if (baselineMaxFaceFt === null) continue;

    const selection = selectTrustedForecastAuthority({
      entry: coverage,
      localDate,
      issues,
      buildAnchorAt,
    });

    const primary = selection.primary;
    if (primary === null || selection.primaryTier === null) {
      decisions.push({
        beachId: coverage.beachId,
        localDate,
        localTimezone: timeZone,
        status: "no_authority",
        primaryIssueId: null,
        baselineMaxFaceFt,
        trustedMinFaceFt: null,
        trustedMaxFaceFt: null,
        signedGapFt: null,
        appliedDeltaFt: 0,
      });
      continue;
    }

    // The primary row's own min/max is the trusted range. Corroborators never
    // widen, average or union it (D-12).
    const trustedMinFaceFt = roundFt(primary.minFaceFt as number);
    const trustedMaxFaceFt = roundFt(primary.maxFaceFt as number);

    // D-11: only an independent lineage whose window overlaps the primary's can
    // disagree. `day` and `night` describe disjoint halves of one local date.
    let worstConflict: {
      issue: TrustedForecastIssue;
      separationFt: number;
    } | null = null;
    for (const corroborator of selection.corroborators) {
      if (!dayPartsOverlap(primary.dayPart, corroborator.dayPart)) continue;
      const separationFt = nearestEdgeSeparationFt(
        { minFt: trustedMinFaceFt, maxFt: trustedMaxFaceFt },
        {
          minFt: roundFt(corroborator.minFaceFt as number),
          maxFt: roundFt(corroborator.maxFaceFt as number),
        },
      );
      if (worstConflict === null || separationFt > worstConflict.separationFt) {
        worstConflict = { issue: corroborator, separationFt };
      }
    }

    if (
      worstConflict !== null &&
      worstConflict.separationFt > TRUSTED_FORECAST_CONFLICT_THRESHOLD_FT
    ) {
      decisions.push({
        beachId: coverage.beachId,
        localDate,
        localTimezone: timeZone,
        status: "blocked_conflict",
        primaryIssueId: primary.issueId,
        baselineMaxFaceFt,
        trustedMinFaceFt,
        trustedMaxFaceFt,
        signedGapFt: null,
        appliedDeltaFt: 0,
      });
      alerts.push({
        beachId: coverage.beachId,
        localDate,
        alertCode: TRUSTED_FORECAST_ALERT_RANGE_SEPARATION,
        separationFt: worstConflict.separationFt,
        primaryIssueId: primary.issueId,
        conflictingIssueId: worstConflict.issue.issueId,
        evidence: {
          policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
          primaryTier: selection.primaryTier,
          primaryLineage: primary.providerLineage,
          primaryDayPart: primary.dayPart,
          primaryValidityBasis: primary.validityBasis,
          primaryMinFaceFt: trustedMinFaceFt,
          primaryMaxFaceFt: trustedMaxFaceFt,
          conflictingLineage: worstConflict.issue.providerLineage,
          conflictingDayPart: worstConflict.issue.dayPart,
          conflictingValidityBasis: worstConflict.issue.validityBasis,
          conflictingMinFaceFt: roundFt(worstConflict.issue.minFaceFt as number),
          conflictingMaxFaceFt: roundFt(worstConflict.issue.maxFaceFt as number),
        },
      });
      continue;
    }

    const gapFt = signedGapFt(
      baselineMaxFaceFt,
      trustedMinFaceFt,
      trustedMaxFaceFt,
    );
    const appliedDeltaFt = appliedDeltaFtForGap(gapFt);

    decisions.push({
      beachId: coverage.beachId,
      localDate,
      localTimezone: timeZone,
      status: appliedDeltaFt === 0 ? "no_adjustment" : "applied",
      primaryIssueId: primary.issueId,
      baselineMaxFaceFt,
      trustedMinFaceFt,
      trustedMaxFaceFt,
      signedGapFt: gapFt,
      appliedDeltaFt,
    });

    if (appliedDeltaFt === 0) continue;

    for (const slot of group.slots) {
      if (!slotIsInPrimaryDayPart(slot, primary.dayPart, timeZone)) continue;
      const slotBaseline =
        slot.baselineMaxFaceFt === null ||
        !Number.isFinite(slot.baselineMaxFaceFt)
          ? null
          : roundFt(slot.baselineMaxFaceFt);
      applications.push({
        beachId: coverage.beachId,
        localDate,
        forecastAt: slot.forecastAt.toISOString(),
        forecastHorizonBucket: slot.forecastHorizonBucket ?? "",
        displaySource: TRUSTED_FORECAST_ADJUSTED_DISPLAY_SOURCE,
        appliedDeltaFt,
        baselineMaxFaceFt: slotBaseline,
        adjustedMaxFaceFt:
          slotBaseline === null
            ? null
            : roundFt(Math.max(0, slotBaseline + appliedDeltaFt)),
      });
    }
  }

  return {
    policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
    decisions,
    applications,
    alerts,
    reusedDecisions,
  };
}

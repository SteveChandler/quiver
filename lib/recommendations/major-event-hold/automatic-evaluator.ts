import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import { deterministicUuidV8 } from "./identity";

const OFFICIAL_POLICY_VERSION = "official-rip-high.v1" as const;
const FRESHNESS_PAST_MILLISECONDS = 12 * 60 * 60 * 1000;
const FRESHNESS_FUTURE_MILLISECONDS = 5 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RAW_FIXED_OFFSET_PATTERN = /^[+-](?:0\d|1\d|2[0-3])(?::?[0-5]\d)?$/;

const officialRiskCandidateRowSchema = z
  .object({
    id: z.string().uuid(),
    beach_id: z.string().uuid(),
    valid_date: z.string().regex(DATE_PATTERN),
    risk_level: z.enum(["low", "moderate", "high"]),
    source: z.enum(["srf", "alert", "derived"]),
    fetched_at: z.string().datetime({ offset: true }),
    beach_timezone: z.unknown(),
  })
  .strict();

export interface EvaluateOfficialRipCurrentHoldsInput {
  rows: unknown;
  now: Date;
}

export interface OfficialRipCurrentHoldProposal {
  holdId: string;
  beachId: string;
  validDate: string;
  transition: "activation";
  triggerType: "automatic_official";
  automaticPolicyVersion: typeof OFFICIAL_POLICY_VERSION;
  scopeBeachIds: [string];
  affectedCohorts: ["beginner", "intermediate", "unknown"];
  action: "suppress_positive";
  supportingEvidenceRefs: [string];
  validFrom: string;
  validUntil: string;
  effectiveAt: string;
  expiresAt: string;
  idempotencyKey: string;
  requestId: string;
}

export interface OfficialRipCurrentHoldDiagnostics {
  proposals: OfficialRipCurrentHoldProposal[];
  invalidMetadataCount: number;
}

interface OfficialRiskRow {
  id: string;
  beach_id: string;
  valid_date: string;
  risk_level: "high";
  source: "srf" | "alert";
  fetched_at: string;
  beach_timezone: string;
}

type CandidateClassification =
  | { state: "eligible"; row: OfficialRiskRow }
  | { state: "ineligible" }
  | { state: "invalid_metadata" };

function isRuntimeValidNamedTimeZone(timezone: string): boolean {
  if (RAW_FIXED_OFFSET_PATTERN.test(timezone)) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0);
    return true;
  } catch {
    return false;
  }
}

function addCivilDays(date: string, days: number): string | null {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function getLocalWindow(
  validDate: string,
  timezone: string,
): { validFrom: Date; validUntil: Date } | null {
  const nextDate = addCivilDays(validDate, 1);
  if (!nextDate) return null;

  try {
    const validFrom = fromZonedTime(`${validDate}T00:00:00.000`, timezone);
    const validUntil = fromZonedTime(`${nextDate}T00:00:00.000`, timezone);
    if (
      !Number.isFinite(validFrom.getTime()) ||
      !Number.isFinite(validUntil.getTime()) ||
      validUntil <= validFrom
    ) {
      return null;
    }
    return { validFrom, validUntil };
  } catch {
    return null;
  }
}

function isEligibleDate(
  validDate: string,
  timezone: string,
  now: Date,
): boolean {
  try {
    const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
    const lastEligibleDate = addCivilDays(today, 2);
    return (
      lastEligibleDate !== null &&
      addCivilDays(validDate, 0) === validDate &&
      validDate >= today &&
      validDate <= lastEligibleDate
    );
  } catch {
    return false;
  }
}

function classifyCandidate(row: unknown, now: Date): CandidateClassification {
  const parsed = officialRiskCandidateRowSchema.safeParse(row);
  if (!parsed.success) return { state: "ineligible" };
  if (
    parsed.data.risk_level !== "high" ||
    (parsed.data.source !== "srf" && parsed.data.source !== "alert")
  ) {
    return { state: "ineligible" };
  }

  const fetchedAt = Date.parse(parsed.data.fetched_at);
  const earliest = now.getTime() - FRESHNESS_PAST_MILLISECONDS;
  const latest = now.getTime() + FRESHNESS_FUTURE_MILLISECONDS;
  if (fetchedAt < earliest || fetchedAt > latest) {
    return { state: "ineligible" };
  }

  const timezone = parsed.data.beach_timezone;
  if (
    typeof timezone !== "string" ||
    timezone.length === 0 ||
    timezone.length > 128 ||
    !isRuntimeValidNamedTimeZone(timezone)
  ) {
    return { state: "invalid_metadata" };
  }
  if (addCivilDays(parsed.data.valid_date, 0) !== parsed.data.valid_date) {
    return { state: "invalid_metadata" };
  }
  if (!isEligibleDate(parsed.data.valid_date, timezone, now)) {
    return { state: "ineligible" };
  }
  if (!getLocalWindow(parsed.data.valid_date, timezone)) {
    return { state: "invalid_metadata" };
  }
  return {
    state: "eligible",
    row: {
      ...parsed.data,
      risk_level: "high",
      source: parsed.data.source,
      beach_timezone: timezone,
    },
  };
}

function preferRow(
  candidate: OfficialRiskRow,
  current: OfficialRiskRow,
): boolean {
  const candidateFetchedAt = Date.parse(candidate.fetched_at);
  const currentFetchedAt = Date.parse(current.fetched_at);
  if (candidateFetchedAt !== currentFetchedAt) {
    return candidateFetchedAt > currentFetchedAt;
  }
  return candidate.id < current.id;
}

function toProposal(
  row: OfficialRiskRow,
  now: Date,
): OfficialRipCurrentHoldProposal | null {
  const window = getLocalWindow(row.valid_date, row.beach_timezone);
  if (!window) return null;

  const identityInput =
    `quiver:regional-hold:official-rip-high:v1:` +
    `${row.beach_id}:${row.valid_date}`;
  const holdId = deterministicUuidV8(identityInput);
  const evidenceReference = `official:rip_current_risks:${row.id}`;
  const validFrom = window.validFrom.toISOString();
  const validUntil = window.validUntil.toISOString();

  return {
    holdId,
    beachId: row.beach_id,
    validDate: row.valid_date,
    transition: "activation",
    triggerType: "automatic_official",
    automaticPolicyVersion: OFFICIAL_POLICY_VERSION,
    scopeBeachIds: [row.beach_id],
    affectedCohorts: ["beginner", "intermediate", "unknown"],
    action: "suppress_positive",
    supportingEvidenceRefs: [evidenceReference],
    validFrom,
    validUntil,
    effectiveAt:
      row.valid_date === formatInTimeZone(now, row.beach_timezone, "yyyy-MM-dd")
        ? now.toISOString()
        : validFrom,
    expiresAt: validUntil,
    idempotencyKey: `auto:official_rip_high:v1:${row.beach_id}:${row.valid_date}`,
    requestId: holdId,
  };
}

export function evaluateOfficialRipCurrentHoldDiagnostics({
  rows,
  now,
}: EvaluateOfficialRipCurrentHoldsInput): OfficialRipCurrentHoldDiagnostics {
  if (!Array.isArray(rows) || !Number.isFinite(now.getTime())) {
    return { proposals: [], invalidMetadataCount: 0 };
  }

  const selectedRows = new Map<string, OfficialRiskRow>();
  let invalidMetadataCount = 0;
  for (const input of rows) {
    const classification = classifyCandidate(input, now);
    if (classification.state === "invalid_metadata") {
      invalidMetadataCount += 1;
      continue;
    }
    if (classification.state === "ineligible") continue;
    const { row } = classification;
    const key = `${row.beach_id}:${row.valid_date}`;
    const current = selectedRows.get(key);
    if (!current || preferRow(row, current)) {
      selectedRows.set(key, row);
    }
  }

  const proposals = [...selectedRows.values()]
    .sort((left, right) => {
      const beachComparison = left.beach_id.localeCompare(right.beach_id);
      return beachComparison || left.valid_date.localeCompare(right.valid_date);
    })
    .flatMap((row) => {
      const proposal = toProposal(row, now);
      return proposal ? [proposal] : [];
    });

  return { proposals, invalidMetadataCount };
}

export function evaluateOfficialRipCurrentHolds(
  input: EvaluateOfficialRipCurrentHoldsInput,
): OfficialRipCurrentHoldProposal[] {
  return evaluateOfficialRipCurrentHoldDiagnostics(input).proposals;
}

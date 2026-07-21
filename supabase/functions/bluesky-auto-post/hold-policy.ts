export interface HoldAuthorizationContext {
  beachId: string;
  startsAt: string;
  endsAt: string;
}

export type HoldAuthorizationResolution =
  | { state: "resolved"; blockedContextKeys: Set<string> }
  | { state: "unavailable"; blockedContextKeys: Set<string> };

interface ParsedHoldRow {
  recordId: string;
  holdId: string;
  version: number;
  scopeBeachIds: string[];
  affectedCohorts: string[];
  validFromMs: number;
  validUntilMs: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ABSOLUTE_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const HOLD_ACTIONS = new Set([
  "suppress_positive",
  "protected_alternatives_only",
]);
const SAFETY_COHORTS = new Set([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "unknown",
]);

function unavailableResolution(): HoldAuthorizationResolution {
  return { state: "unavailable", blockedContextKeys: new Set() };
}

function parseAbsoluteInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ABSOLUTE_INSTANT_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === "Z" ? 0 : Number(match[8]);
  const offsetMinute = match[7] === "Z" ? 0 : Number(match[9]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function parseStringArray(
  value: unknown,
  isAllowed: (item: string) => boolean,
  allowEmpty: boolean,
): string[] | null {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    !value.every((item) => typeof item === "string" && isAllowed(item)) ||
    !hasUniqueValues(value)
  ) {
    return null;
  }
  return value;
}

function parseAuthorizationContext(
  value: HoldAuthorizationContext,
): HoldAuthorizationContext | null {
  const startsAtMs = parseAbsoluteInstant(value.startsAt);
  const endsAtMs = parseAbsoluteInstant(value.endsAt);
  if (
    !UUID_PATTERN.test(value.beachId) ||
    startsAtMs === null ||
    endsAtMs === null ||
    endsAtMs <= startsAtMs
  ) {
    return null;
  }
  return {
    beachId: value.beachId.toLowerCase(),
    startsAt: value.startsAt,
    endsAt: value.endsAt,
  };
}

function parseHoldRow(value: unknown, asOfMs: number): ParsedHoldRow | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const recordId = typeof row.record_id === "string" ? row.record_id : "";
  const holdId = typeof row.hold_id === "string" ? row.hold_id : "";
  const scopeBeachIds = parseStringArray(
    row.scope_beach_ids,
    (item) => UUID_PATTERN.test(item),
    false,
  );
  const affectedCohorts = parseStringArray(
    row.affected_cohorts,
    (item) => SAFETY_COHORTS.has(item),
    false,
  );
  const scopeExposureClasses = parseStringArray(
    row.scope_exposure_classes,
    () => true,
    true,
  );
  const validFromMs = parseAbsoluteInstant(row.valid_from);
  const validUntilMs = parseAbsoluteInstant(row.valid_until);
  const effectiveAtMs = parseAbsoluteInstant(row.effective_at);
  const expiresAtMs = parseAbsoluteInstant(row.expires_at);

  if (
    !UUID_PATTERN.test(recordId) ||
    !UUID_PATTERN.test(holdId) ||
    !Number.isInteger(row.version) ||
    Number(row.version) <= 0 ||
    row.status !== "active" ||
    typeof row.action !== "string" ||
    !HOLD_ACTIONS.has(row.action) ||
    scopeBeachIds === null ||
    affectedCohorts === null ||
    scopeExposureClasses === null ||
    scopeExposureClasses.length !== 0 ||
    validFromMs === null ||
    validUntilMs === null ||
    effectiveAtMs === null ||
    expiresAtMs === null ||
    validUntilMs <= validFromMs ||
    expiresAtMs <= effectiveAtMs ||
    effectiveAtMs > asOfMs ||
    expiresAtMs <= asOfMs
  ) {
    return null;
  }

  return {
    recordId: recordId.toLowerCase(),
    holdId: holdId.toLowerCase(),
    version: Number(row.version),
    scopeBeachIds: scopeBeachIds.map((id) => id.toLowerCase()),
    affectedCohorts,
    validFromMs,
    validUntilMs,
  };
}

export function authorizationContextKey(
  context: HoldAuthorizationContext,
): string {
  return `${context.beachId.toLowerCase()}|${context.startsAt}|${context.endsAt}`;
}

export function evaluateHoldAuthorizationRows(input: {
  contexts: readonly HoldAuthorizationContext[];
  rows: unknown;
  asOf: string;
}): HoldAuthorizationResolution {
  const asOfMs = parseAbsoluteInstant(input.asOf);
  if (asOfMs === null || !Array.isArray(input.rows)) {
    return unavailableResolution();
  }

  const contexts = input.contexts.map(parseAuthorizationContext);
  if (contexts.some((context) => context === null)) {
    return unavailableResolution();
  }
  const validContexts = contexts as HoldAuthorizationContext[];
  const contextKeys = validContexts.map(authorizationContextKey);
  if (!hasUniqueValues(contextKeys)) return unavailableResolution();
  if (validContexts.length === 0) {
    return input.rows.length === 0
      ? { state: "resolved", blockedContextKeys: new Set() }
      : unavailableResolution();
  }

  const rows = input.rows.map((row) => parseHoldRow(row, asOfMs));
  if (rows.some((row) => row === null)) return unavailableResolution();
  const validRows = rows as ParsedHoldRow[];
  if (
    !hasUniqueValues(validRows.map(({ holdId }) => holdId)) ||
    !hasUniqueValues(validRows.map(({ recordId }) => recordId))
  ) {
    return unavailableResolution();
  }

  const blockedContextKeys = new Set<string>();
  for (const row of validRows) {
    const matchingContexts = validContexts.filter((context) => {
      const startsAtMs = Date.parse(context.startsAt);
      const endsAtMs = Date.parse(context.endsAt);
      return (
        row.scopeBeachIds.includes(context.beachId) &&
        row.validFromMs < endsAtMs &&
        row.validUntilMs > startsAtMs
      );
    });
    if (matchingContexts.length === 0) return unavailableResolution();
    if (!row.affectedCohorts.includes("unknown")) continue;
    for (const context of matchingContexts) {
      blockedContextKeys.add(authorizationContextKey(context));
    }
  }

  return { state: "resolved", blockedContextKeys };
}

export function shouldUseObjectiveSafetyPost(
  mode: string,
  resolution: HoldAuthorizationResolution,
): boolean {
  if (mode === "off" || mode === "shadow") return false;
  if (mode !== "enforce") return true;
  return (
    resolution.state === "unavailable" ||
    resolution.blockedContextKeys.size > 0
  );
}

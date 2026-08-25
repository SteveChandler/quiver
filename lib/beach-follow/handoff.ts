import {
  HANDOFF_CONTEXT_VERSION,
  HandoffRecommendationMode,
  HandoffRecommendationVerdict,
  HandoffSourceSurface,
  type HandoffContext,
  type HandoffParseResult,
  type HandoffReplacementIdentity,
  type HandoffResolutionResult,
  type PriorRecommendationSummary,
} from "@/types/exact-handoff";

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
export const HANDOFF_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_SERIALIZED_LENGTH = 4_096;
const MAX_RECOMMENDATION_ID_LENGTH = 128;
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CANONICAL_WINDOW_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const RECOMMENDATION_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const SLUGGED_WINDOW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;
const HASHED_WINDOW_ID_PATTERN = /^[0-9a-f]{24}$/;
const STRUCTURED_RECOMMENDATION_PATTERN =
  /^(beach|custom|beach-detail):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(.+)$/;
const TOP_LEVEL_KEYS = new Set([
  "v",
  "beachId",
  "slug",
  "windowId",
  "sourceSurface",
  "generatedAt",
  "expiresAt",
  "priorRecommendation",
]);
const PRIOR_RECOMMENDATION_KEYS = new Set([
  "recommendationId",
  "mode",
  "verdict",
]);
const SOURCE_SURFACES = new Set<string>(Object.values(HandoffSourceSurface));
const RECOMMENDATION_MODES = new Set<string>(
  Object.values(HandoffRecommendationMode),
);
const RECOMMENDATION_VERDICTS = new Set<string>(
  Object.values(HandoffRecommendationVerdict),
);

export interface BuildHandoffContextInput {
  beachId: string;
  slug: string;
  windowId: string;
  sourceSurface: HandoffSourceSurface;
  priorRecommendation: PriorRecommendationSummary;
}

export interface BuildHandoffContextOptions {
  now?: Date;
  ttlMs?: number;
}

export interface HandoffResolutionAvailability {
  now?: Date;
  beachExists: boolean;
  exactWindowExists: boolean;
  replacement?: HandoffReplacementIdentity | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isBeachId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}

function isWindowId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (HASHED_WINDOW_ID_PATTERN.test(value)) return true;
  const sluggedWindow = value.match(SLUGGED_WINDOW_ID_PATTERN);
  if (sluggedWindow) {
    const instant = `${sluggedWindow[1]}:${sluggedWindow[2]}:${sluggedWindow[3]}.${sluggedWindow[4]}Z`;
    return instantMillis(instant) !== null;
  }
  if (!CANONICAL_WINDOW_INSTANT_PATTERN.test(value)) return false;
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString() === value;
}

function isRecommendationId(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_RECOMMENDATION_ID_LENGTH
  ) {
    return false;
  }
  if (HASHED_WINDOW_ID_PATTERN.test(value)) return true;
  const match = value.match(STRUCTURED_RECOMMENDATION_PATTERN);
  return Boolean(match && recommendationInstantMillis(match[3]) !== null);
}

function isSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 100 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function instantMillis(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    !CANONICAL_WINDOW_INSTANT_PATTERN.test(value)
  ) {
    return null;
  }
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString() === value
    ? millis
    : null;
}

function recommendationInstantMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(RECOMMENDATION_INSTANT_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number((match[7] ?? "").padEnd(3, "0"));
  const offsetHours = match[8] === "Z" ? 0 : Number(match[10]);
  const offsetMinutes = match[8] === "Z" ? 0 : Number(match[11]);
  if (
    offsetHours > 14 ||
    offsetMinutes > 59 ||
    (offsetHours === 14 && offsetMinutes !== 0)
  ) {
    return null;
  }

  const offsetDirection = match[9] === "-" ? -1 : 1;
  const offsetMillis =
    offsetDirection * (offsetHours * 60 + offsetMinutes) * 60_000;
  const wallClock = new Date(0);
  wallClock.setUTCFullYear(year, month - 1, day);
  wallClock.setUTCHours(hour, minute, second, millisecond);
  const millis = wallClock.getTime() - offsetMillis;
  if (!Number.isFinite(millis)) return null;

  const roundTrip = new Date(millis + offsetMillis);
  return roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day &&
    roundTrip.getUTCHours() === hour &&
    roundTrip.getUTCMinutes() === minute &&
    roundTrip.getUTCSeconds() === second &&
    roundTrip.getUTCMilliseconds() === millisecond
    ? millis
    : null;
}

function isPriorRecommendationSummary(
  value: unknown,
  contextBeachId: string,
): value is PriorRecommendationSummary {
  if (!isRecord(value) || !hasOnlyKeys(value, PRIOR_RECOMMENDATION_KEYS)) {
    return false;
  }

  const structuredRecommendation = typeof value.recommendationId === "string"
    ? value.recommendationId.match(STRUCTURED_RECOMMENDATION_PATTERN)
    : null;

  return (
    isRecommendationId(value.recommendationId) &&
    (!structuredRecommendation || structuredRecommendation[2] === contextBeachId) &&
    typeof value.mode === "string" &&
    RECOMMENDATION_MODES.has(value.mode) &&
    typeof value.verdict === "string" &&
    RECOMMENDATION_VERDICTS.has(value.verdict)
  );
}

function isHandoffContext(value: unknown): value is HandoffContext {
  if (!isRecord(value) || !hasOnlyKeys(value, TOP_LEVEL_KEYS)) return false;
  if (value.v !== HANDOFF_CONTEXT_VERSION) return false;

  const generatedAt = instantMillis(value.generatedAt);
  const expiresAt = instantMillis(value.expiresAt);
  if (generatedAt === null || expiresAt === null) return false;
  if (expiresAt <= generatedAt || expiresAt - generatedAt > MAX_TTL_MS) {
    return false;
  }

  return (
    isBeachId(value.beachId) &&
    isSlug(value.slug) &&
    isWindowId(value.windowId) &&
    typeof value.sourceSurface === "string" &&
    SOURCE_SURFACES.has(value.sourceSurface) &&
    isPriorRecommendationSummary(value.priorRecommendation, value.beachId)
  );
}

function isReplacementIdentity(
  value: HandoffReplacementIdentity | null | undefined,
  contextBeachId: string,
): value is HandoffReplacementIdentity {
  if (
    !value
    || !isBeachId(value.beachId)
    || value.beachId !== contextBeachId
    || !isSlug(value.slug)
    || !isWindowId(value.windowId)
    || !isRecommendationId(value.recommendationId)
  ) {
    return false;
  }

  const structuredRecommendation = value.recommendationId.match(
    STRUCTURED_RECOMMENDATION_PATTERN,
  );
  return !structuredRecommendation
    || structuredRecommendation[2] === value.beachId;
}

export function buildHandoffContext(
  input: BuildHandoffContextInput,
  options: BuildHandoffContextOptions = {},
): HandoffContext {
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid handoff generation time");
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
    throw new Error("Invalid handoff TTL");
  }

  const context: HandoffContext = {
    v: HANDOFF_CONTEXT_VERSION,
    beachId: input.beachId,
    slug: input.slug,
    windowId: input.windowId,
    sourceSurface: input.sourceSurface,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    priorRecommendation: input.priorRecommendation,
  };

  if (!isHandoffContext(context)) throw new Error("Invalid handoff context");
  return context;
}

export function serializeHandoffContext(context: HandoffContext): string {
  if (!isHandoffContext(context)) throw new Error("Invalid handoff context");
  return JSON.stringify(context);
}

export function parseHandoffContext(value: unknown): HandoffParseResult {
  let parsed: unknown = value;
  if (typeof value === "string") {
    if (value.length === 0 || value.length > MAX_SERIALIZED_LENGTH) {
      return { ok: false, reason: "malformed" };
    }
    try {
      parsed = JSON.parse(value);
    } catch {
      return { ok: false, reason: "malformed" };
    }
  }

  if (
    isRecord(parsed) &&
    "v" in parsed &&
    parsed.v !== HANDOFF_CONTEXT_VERSION
  ) {
    return { ok: false, reason: "unsupported_version" };
  }
  if (!isHandoffContext(parsed)) return { ok: false, reason: "malformed" };

  return { ok: true, context: parsed };
}

export function classifyHandoffResolution(
  value: unknown,
  availability: HandoffResolutionAvailability,
): HandoffResolutionResult {
  const parsed = parseHandoffContext(value);
  if (!parsed.ok) return { classification: "invalid", reason: parsed.reason };

  const { context } = parsed;
  const now = availability.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    return { classification: "invalid", reason: "malformed" };
  }
  if (
    Date.parse(context.generatedAt) >
    now.getTime() + HANDOFF_FUTURE_SKEW_MS
  ) {
    return { classification: "invalid", reason: "malformed" };
  }
  if (!availability.beachExists) {
    return { classification: "invalid", reason: "beach_removed" };
  }
  if (now.getTime() >= Date.parse(context.expiresAt)) {
    return { classification: "beach_only", context, reason: "expired" };
  }
  if (availability.exactWindowExists) {
    return { classification: "exact", context };
  }
  if (isReplacementIdentity(availability.replacement, context.beachId)) {
    return {
      classification: "replaced",
      context,
      replacement: availability.replacement,
      reason: "window_replaced",
    };
  }

  return { classification: "beach_only", context, reason: "window_removed" };
}

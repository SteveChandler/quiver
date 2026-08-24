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
const MAX_SERIALIZED_LENGTH = 4_096;
const MAX_IDENTIFIER_LENGTH = 200;
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

function isBoundedIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
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
  if (typeof value !== "string" || value.length > 40) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

function isPriorRecommendationSummary(
  value: unknown,
): value is PriorRecommendationSummary {
  if (!isRecord(value) || !hasOnlyKeys(value, PRIOR_RECOMMENDATION_KEYS)) {
    return false;
  }

  return (
    isBoundedIdentifier(value.recommendationId) &&
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
    isBoundedIdentifier(value.beachId) &&
    isSlug(value.slug) &&
    isBoundedIdentifier(value.windowId) &&
    typeof value.sourceSurface === "string" &&
    SOURCE_SURFACES.has(value.sourceSurface) &&
    isPriorRecommendationSummary(value.priorRecommendation)
  );
}

function isReplacementIdentity(
  value: HandoffReplacementIdentity | null | undefined,
): value is HandoffReplacementIdentity {
  return Boolean(
    value &&
      isBoundedIdentifier(value.beachId) &&
      isSlug(value.slug) &&
      isBoundedIdentifier(value.windowId) &&
      isBoundedIdentifier(value.recommendationId),
  );
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
  if (!availability.beachExists) {
    return { classification: "invalid", reason: "beach_removed" };
  }

  const now = availability.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    return { classification: "invalid", reason: "malformed" };
  }
  if (now.getTime() >= Date.parse(context.expiresAt)) {
    return { classification: "beach_only", context, reason: "expired" };
  }
  if (availability.exactWindowExists) {
    return { classification: "exact", context };
  }
  if (isReplacementIdentity(availability.replacement)) {
    return {
      classification: "replaced",
      context,
      replacement: availability.replacement,
      reason: "window_replaced",
    };
  }

  return { classification: "beach_only", context, reason: "window_removed" };
}

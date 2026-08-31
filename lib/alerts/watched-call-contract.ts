export const WATCHED_CALL_REPLACEMENT_MARGIN = 10;

export interface StableWatchedWindow {
  id: string;
  bucket: "morning" | "midday" | "evening";
  start: string;
  end: string;
  peakTime: string;
  beachId: string;
  rankingScore: number;
  verdict: "worth_it" | "maybe" | "skip";
  rideable: boolean;
  safe: boolean;
}

export interface WatchedCallIdentity {
  alertRule: { id: string; beach_id: string };
  recommendation: {
    recommendationId: string;
    beachId: string;
    windowStart: string;
    windowEnd: string;
    forecastAt: string | null;
    recommendationState: string;
    conditionScore: number;
    personalMatchScore: number;
    overallScore: number;
    reasonType: string;
  };
}

export interface StabilityRecord {
  version: 1;
  localDate: string;
  acceptedAt: string;
  candidateFingerprint: string;
  requestFingerprint: string;
  scorerVersion: string;
  recommendation: StableWatchedWindow;
}

export interface StabilityResult {
  evaluatedAt: string;
  baseline: StableWatchedWindow | null;
  incumbent: StableWatchedWindow | null;
  winner: StableWatchedWindow | null;
  status: "empty" | "created" | "retained" | "replaced" | "cleared";
  reason:
    | "no_baseline"
    | "no_fresh_winner"
    | "request_fingerprint_changed"
    | "candidate_fingerprint_changed"
    | "incumbent_still_best"
    | "challenger_below_margin"
    | "challenger_margin"
    | "incumbent_missing"
    | "incumbent_passed"
    | "incumbent_unsafe"
    | "incumbent_unrideable"
    | "incumbent_skip";
  scoreDelta: number | null;
  recommendation: StableWatchedWindow | null;
  showChangeNotice: boolean;
}

const canonicalStabilityResults = new WeakSet<object>();
const canonicalNearbyComparisons = new WeakSet<object>();

function canonical(result: StabilityResult): StabilityResult {
  const frozen = Object.freeze({
    ...result,
    baseline: result.baseline ? Object.freeze({ ...result.baseline }) : null,
    incumbent: result.incumbent ? Object.freeze({ ...result.incumbent }) : null,
    winner: result.winner ? Object.freeze({ ...result.winner }) : null,
    recommendation: result.recommendation
      ? Object.freeze({ ...result.recommendation })
      : null,
  });
  canonicalStabilityResults.add(frozen);
  return frozen;
}

function overlapRatio(a: StableWatchedWindow, b: StableWatchedWindow): number {
  const start = Math.max(Date.parse(a.start), Date.parse(b.start));
  const end = Math.min(Date.parse(a.end), Date.parse(b.end));
  const duration = Math.min(
    Date.parse(a.end) - Date.parse(a.start),
    Date.parse(b.end) - Date.parse(b.start),
  );
  return duration > 0 ? Math.max(0, end - start) / duration : 0;
}

function findIncumbent(
  prior: StableWatchedWindow,
  windows: StableWatchedWindow[],
): StableWatchedWindow | null {
  return windows.find((window) => window.id === prior.id)
    ?? windows.find((window) =>
      window.beachId === prior.beachId
      && window.bucket === prior.bucket
      && overlapRatio(window, prior) >= 0.5,
    )
    ?? null;
}

function eligible(window: StableWatchedWindow, now: Date): boolean {
  return window.safe
    && window.rideable
    && window.verdict !== "skip"
    && Date.parse(window.end) > now.getTime();
}

export function resolveWeekScoutStability(args: {
  baseline: StabilityRecord | null;
  fresh: {
    localDate: string;
    generatedAt: string;
    scorerVersion: string;
    candidateFingerprint: string;
    requestFingerprint: string;
    windows: StableWatchedWindow[];
    bestWindowId: string | null;
  };
  now: Date;
}): StabilityResult {
  const { baseline, fresh, now } = args;
  const winner = fresh.windows.find((window) => window.id === fresh.bestWindowId) ?? null;
  const base = baseline?.recommendation ?? null;
  const common = { evaluatedAt: now.toISOString(), baseline: base };
  if (!baseline) {
    return canonical({ ...common, incumbent: null, winner, status: winner ? "created" : "empty", reason: "no_baseline", scoreDelta: null, recommendation: winner, showChangeNotice: false });
  }
  if (!winner) {
    return canonical({ ...common, incumbent: null, winner: null, status: "cleared", reason: "no_fresh_winner", scoreDelta: null, recommendation: null, showChangeNotice: false });
  }
  if (baseline.requestFingerprint !== fresh.requestFingerprint) {
    return canonical({ ...common, incumbent: null, winner, status: "created", reason: "request_fingerprint_changed", scoreDelta: null, recommendation: winner, showChangeNotice: false });
  }
  if (baseline.candidateFingerprint !== fresh.candidateFingerprint) {
    return canonical({ ...common, incumbent: null, winner, status: "created", reason: "candidate_fingerprint_changed", scoreDelta: null, recommendation: winner, showChangeNotice: false });
  }
  const incumbent = findIncumbent(base!, fresh.windows);
  if (!incumbent) {
    return canonical({ ...common, incumbent: null, winner, status: "replaced", reason: "incumbent_missing", scoreDelta: null, recommendation: winner, showChangeNotice: true });
  }
  const invalidReason = Date.parse(incumbent.end) <= now.getTime()
    ? "incumbent_passed"
    : !incumbent.safe
      ? "incumbent_unsafe"
      : !incumbent.rideable
        ? "incumbent_unrideable"
        : incumbent.verdict === "skip"
          ? "incumbent_skip"
          : null;
  if (invalidReason) {
    const replacement = fresh.windows.find((window) => eligible(window, now)) ?? null;
    return canonical({
      ...common,
      incumbent,
      winner: replacement,
      status: replacement ? "replaced" : "cleared",
      reason: replacement ? invalidReason : "no_fresh_winner",
      scoreDelta: null,
      recommendation: replacement,
      showChangeNotice: invalidReason !== "incumbent_passed",
    });
  }
  if (winner.id === incumbent.id) {
    return canonical({ ...common, incumbent, winner, status: "retained", reason: "incumbent_still_best", scoreDelta: 0, recommendation: incumbent, showChangeNotice: false });
  }
  const scoreDelta = winner.rankingScore - incumbent.rankingScore;
  if (scoreDelta < WATCHED_CALL_REPLACEMENT_MARGIN) {
    return canonical({ ...common, incumbent, winner, status: "retained", reason: "challenger_below_margin", scoreDelta, recommendation: incumbent, showChangeNotice: false });
  }
  return canonical({ ...common, incumbent, winner, status: "replaced", reason: "challenger_margin", scoreDelta, recommendation: winner, showChangeNotice: true });
}

export interface NearbyComparison {
  watchedRecommendation: WatchedCallIdentity["recommendation"];
  nearbyRecommendation: WatchedCallIdentity["recommendation"];
  refreshedWatchedViability: boolean;
  strongerMargin: number;
}

export function resolveWatchedCallNearbyComparison(args: Omit<NearbyComparison, "strongerMargin">): NearbyComparison {
  const comparison = Object.freeze({
    ...args,
    strongerMargin: args.nearbyRecommendation.overallScore - args.watchedRecommendation.overallScore,
  });
  canonicalNearbyComparisons.add(comparison);
  return comparison;
}

export type WatchedCallUpdate = {
  type: "still_on" | "call_changed" | "better_nearby";
  cause: string;
  priorIdentity: WatchedCallIdentity;
  currentIdentity: WatchedCallIdentity;
  materiality?: StabilityResult;
  nearbyComparison?: NearbyComparison;
  dedupeKey: string;
};

function sameCall(a: WatchedCallIdentity, b: WatchedCallIdentity): boolean {
  return a.recommendation.recommendationId === b.recommendation.recommendationId
    && a.recommendation.beachId === b.recommendation.beachId
    && a.recommendation.windowStart === b.recommendation.windowStart
    && a.recommendation.windowEnd === b.recommendation.windowEnd;
}

function identityKey(identity: WatchedCallIdentity): string {
  return [identity.alertRule.id, identity.recommendation.recommendationId,
    identity.recommendation.beachId, identity.recommendation.windowStart,
    identity.recommendation.windowEnd, identity.recommendation.forecastAt ?? "",
    identity.recommendation.recommendationState,
    identity.recommendation.conditionScore,
    identity.recommendation.personalMatchScore,
    identity.recommendation.overallScore,
    identity.recommendation.reasonType].map(encodeURIComponent).join(":");
}

export function buildWatchedCallUpdate(input: Omit<WatchedCallUpdate, "dedupeKey">): WatchedCallUpdate | null {
  const { priorIdentity: prior, currentIdentity: current } = input;
  if (prior.alertRule.id !== current.alertRule.id
    || prior.alertRule.beach_id !== current.alertRule.beach_id
    || prior.alertRule.beach_id !== prior.recommendation.beachId) return null;
  if (identityKey(prior) === identityKey(current)) return null;
  if (input.type === "still_on" && (!sameCall(prior, current) || input.cause !== "forecast_refreshed")) return null;
  if (input.type === "call_changed") {
    if (!input.materiality || !canonicalStabilityResults.has(input.materiality)
      || input.materiality.status !== "replaced"
      || input.materiality.recommendation?.id !== current.recommendation.recommendationId) return null;
  }
  if (input.type === "better_nearby") {
    if (!input.nearbyComparison || !canonicalNearbyComparisons.has(input.nearbyComparison)
      || input.nearbyComparison.strongerMargin < WATCHED_CALL_REPLACEMENT_MARGIN
      || !input.nearbyComparison.refreshedWatchedViability
      || current.recommendation.beachId === prior.recommendation.beachId) return null;
  }
  const dedupeKey = ["watched-call.v1", input.type, input.cause, identityKey(prior), identityKey(current)]
    .map(encodeURIComponent).join(":");
  return Object.freeze({ ...input, dedupeKey });
}

export function buildNoChangeSuppression(identity: WatchedCallIdentity) {
  return Object.freeze({
    delivery: "suppressed" as const,
    reason: "no_meaningful_change" as const,
    keepWatchActive: true as const,
    identity,
  });
}

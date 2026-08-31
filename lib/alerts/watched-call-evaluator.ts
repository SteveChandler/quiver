import {
  buildNoChangeSuppression,
  buildWatchedCallUpdate,
  resolveWatchedCallNearbyComparison,
  resolveWeekScoutStability,
  type StableWatchedWindow,
  type WatchedCallIdentity,
} from "./watched-call-contract";

export interface WatchedCallEvaluationInput {
  alertRule: { id: string; beach_id: string };
  watched: Omit<WatchedCallIdentity["recommendation"], "recommendationState"> & {
    recommendationState: string;
  };
  localDate: string;
  generatedAt: string;
  scorerVersion: string;
  candidateFingerprint: string;
  requestFingerprint: string;
  bestWindowId: string | null;
  windows: StableWatchedWindow[];
  now: Date;
  alreadyResponded: boolean;
  lastStillOnAt: Date | null;
  nearbyRecommendation?: WatchedCallEvaluationInput["watched"];
}

type EligibleEvaluation = {
  delivery: "eligible";
  category: "still_on" | "call_changed" | "better_nearby" | "post_window";
  update?: NonNullable<ReturnType<typeof buildWatchedCallUpdate>>;
  dedupeKey: string;
  keepWatchActive: boolean;
};

type SuppressedEvaluation = ReturnType<typeof buildNoChangeSuppression> | {
  delivery: "suppressed";
  reason: "already_responded";
  keepWatchActive: false;
  identity: WatchedCallIdentity;
};

function identity(input: WatchedCallEvaluationInput): WatchedCallIdentity {
  return { alertRule: input.alertRule, recommendation: input.watched };
}

function currentIdentity(
  input: WatchedCallEvaluationInput,
  recommendation: StableWatchedWindow,
): WatchedCallIdentity {
  return {
    alertRule: input.alertRule,
    recommendation: {
      ...input.watched,
      recommendationId: recommendation.id,
      beachId: recommendation.beachId,
      windowStart: recommendation.start,
      windowEnd: recommendation.end,
      forecastAt: input.generatedAt,
      overallScore: recommendation.rankingScore,
    },
  };
}

export function evaluateWatchedCall(input: WatchedCallEvaluationInput): EligibleEvaluation | SuppressedEvaluation {
  const priorIdentity = identity(input);
  if (input.now.getTime() >= Date.parse(input.watched.windowEnd)) {
    if (input.alreadyResponded) {
      return { delivery: "suppressed", reason: "already_responded", keepWatchActive: false, identity: priorIdentity };
    }
    return {
      delivery: "eligible",
      category: "post_window",
      dedupeKey: `watched-call.v1:post_window:${encodeURIComponent(input.alertRule.id)}:${encodeURIComponent(input.watched.windowEnd)}`,
      keepWatchActive: false,
    };
  }

  const materiality = resolveWeekScoutStability({
    baseline: {
      version: 1,
      localDate: input.localDate,
      acceptedAt: input.watched.forecastAt ?? input.generatedAt,
      candidateFingerprint: input.candidateFingerprint,
      requestFingerprint: input.requestFingerprint,
      scorerVersion: input.scorerVersion,
      recommendation: {
        id: input.watched.recommendationId,
        bucket: "morning",
        start: input.watched.windowStart,
        end: input.watched.windowEnd,
        peakTime: input.watched.windowStart,
        beachId: input.watched.beachId,
        rankingScore: input.watched.overallScore,
        verdict: "worth_it",
        rideable: true,
        safe: true,
      },
    },
    fresh: {
      localDate: input.localDate,
      generatedAt: input.generatedAt,
      scorerVersion: input.scorerVersion,
      candidateFingerprint: input.candidateFingerprint,
      requestFingerprint: input.requestFingerprint,
      windows: input.windows,
      bestWindowId: input.bestWindowId,
    },
    now: input.now,
  });

  if (materiality.status === "replaced" && materiality.recommendation) {
    const update = buildWatchedCallUpdate({
      type: "call_changed",
      cause: materiality.reason === "challenger_margin"
        ? "forecast_materially_changed"
        : "incumbent_invalid",
      priorIdentity,
      currentIdentity: currentIdentity(input, materiality.recommendation),
      materiality,
    });
    if (update) return { delivery: "eligible", category: "call_changed", update, dedupeKey: update.dedupeKey, keepWatchActive: true };
  }

  if (input.nearbyRecommendation) {
    const nearbyIdentity: WatchedCallIdentity = {
      alertRule: input.alertRule,
      recommendation: input.nearbyRecommendation,
    };
    const comparison = resolveWatchedCallNearbyComparison({
      watchedRecommendation: priorIdentity.recommendation,
      nearbyRecommendation: nearbyIdentity.recommendation,
      refreshedWatchedViability: materiality.status !== "cleared",
    });
    const update = buildWatchedCallUpdate({
      type: "better_nearby",
      cause: "stronger_nearby_candidate",
      priorIdentity,
      currentIdentity: nearbyIdentity,
      nearbyComparison: comparison,
    });
    if (update) return { delivery: "eligible", category: "better_nearby", update, dedupeKey: update.dedupeKey, keepWatchActive: true };
  }

  const recommendation = materiality.recommendation;
  const nearWindow = Date.parse(input.watched.windowStart) - input.now.getTime() <= 12 * 60 * 60 * 1000;
  const stillOnFresh = !input.lastStillOnAt
    || input.now.getTime() - input.lastStillOnAt.getTime() >= 24 * 60 * 60 * 1000;
  if (!recommendation || !nearWindow || !stillOnFresh) {
    return buildNoChangeSuppression(priorIdentity);
  }
  const update = buildWatchedCallUpdate({
    type: "still_on",
    cause: "forecast_refreshed",
    priorIdentity,
    currentIdentity: currentIdentity(input, recommendation),
  });
  return update
    ? { delivery: "eligible", category: "still_on", update, dedupeKey: update.dedupeKey, keepWatchActive: true }
    : buildNoChangeSuppression(priorIdentity);
}

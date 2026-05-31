import {
  RECOMMENDATIONS_V2_FALLBACK_HORIZON_HOURS,
  RECOMMENDATIONS_V2_MIN_CONDITION_SCORE,
  RECOMMENDATIONS_V2_MIN_PERSONAL_MATCH_SCORE,
} from '@/lib/services/discovery/window-selector/constants';

export {
  RECOMMENDATIONS_V2_FALLBACK_HORIZON_HOURS,
  RECOMMENDATIONS_V2_MIN_CONDITION_SCORE,
  RECOMMENDATIONS_V2_MIN_PERSONAL_MATCH_SCORE,
};

export type RecommendationV2SourceState =
  | 'learned'
  | 'starter_fit'
  | 'avoidance_learning'
  | 'low_confidence'
  | 'degraded';

export type RecommendationV2State =
  | 'ready_today'
  | 'future_fallback'
  | 'no_good_window';

export interface RecommendationV2Candidate {
  recommendationId: string;
  sourceState: RecommendationV2SourceState;
  beach: {
    id: string;
    name: string;
    lat: number | null;
    lon: number | null;
    photo_url?: string | null;
  };
  window: {
    start: Date;
    end: Date;
    timezone: string;
  };
  conditionScore: number;
  personalMatchScore: number;
  overallScore: number;
  label: string;
  reasonType: string;
  proofSummary: string;
  evidenceFacts: Array<Record<string, unknown>>;
  rankingPosition: number;
}

export interface RecommendationV2Item {
  recommendation_id: string;
  source_state: RecommendationV2SourceState;
  beach: RecommendationV2Candidate['beach'];
  window: {
    start: string;
    end: string;
    timezone: string;
  };
  condition_score: number;
  personal_match_score: number;
  overall_score: number;
  label: string;
  reason_type: string;
  proof_summary: string;
  evidence_facts: Array<Record<string, unknown>>;
  ranking_position: number;
  fallback_horizon_hours: number | null;
  fallback_reason: 'today_poor' | null;
}

export interface RecommendationsV2Response {
  state: RecommendationV2State;
  generated_at: string;
  hero: RecommendationV2Item | null;
  items: RecommendationV2Item[];
  watch_window: RecommendationV2Item | null;
  empty_state: {
    title: string | null;
    body: string | null;
    action_label: string | null;
  };
}

interface BuildRecommendationsV2Args {
  candidates: RecommendationV2Candidate[];
  now?: Date;
}

function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

function localDateKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function isToday(candidate: RecommendationV2Candidate, now: Date): boolean {
  return localDateKey(candidate.window.start, candidate.window.timezone) ===
    localDateKey(now, candidate.window.timezone);
}

function isWithinFallbackHorizon(
  candidate: RecommendationV2Candidate,
  now: Date,
): boolean {
  const startMs = candidate.window.start.getTime();
  const nowMs = now.getTime();
  const horizonMs =
    RECOMMENDATIONS_V2_FALLBACK_HORIZON_HOURS * 60 * 60 * 1000;
  return startMs > nowMs && startMs <= nowMs + horizonMs;
}

function isSurfable(candidate: RecommendationV2Candidate): boolean {
  return (
    clampScore(candidate.conditionScore, 100) >=
      RECOMMENDATIONS_V2_MIN_CONDITION_SCORE &&
    clampScore(candidate.personalMatchScore, 10) >=
      RECOMMENDATIONS_V2_MIN_PERSONAL_MATCH_SCORE
  );
}

function byOverallScoreDesc(
  a: RecommendationV2Candidate,
  b: RecommendationV2Candidate,
): number {
  return b.overallScore - a.overallScore;
}

function byStartAsc(
  a: RecommendationV2Candidate,
  b: RecommendationV2Candidate,
): number {
  return a.window.start.getTime() - b.window.start.getTime();
}

function toItem(
  candidate: RecommendationV2Candidate,
  fallback: boolean,
): RecommendationV2Item {
  return {
    recommendation_id: candidate.recommendationId,
    source_state: candidate.sourceState,
    beach: candidate.beach,
    window: {
      start: candidate.window.start.toISOString(),
      end: candidate.window.end.toISOString(),
      timezone: candidate.window.timezone,
    },
    condition_score: clampScore(candidate.conditionScore, 100),
    personal_match_score: clampScore(candidate.personalMatchScore, 10),
    overall_score: clampScore(candidate.overallScore, 100),
    label: candidate.label,
    reason_type: candidate.reasonType,
    proof_summary: candidate.proofSummary,
    evidence_facts: candidate.evidenceFacts,
    ranking_position: candidate.rankingPosition,
    fallback_horizon_hours: fallback
      ? RECOMMENDATIONS_V2_FALLBACK_HORIZON_HOURS
      : null,
    fallback_reason: fallback ? 'today_poor' : null,
  };
}

export function buildRecommendationsV2({
  candidates,
  now = new Date(),
}: BuildRecommendationsV2Args): RecommendationsV2Response {
  const viableCandidates = candidates
    .filter((candidate) => Number.isFinite(candidate.window.start.getTime()))
    .filter((candidate) => Number.isFinite(candidate.window.end.getTime()));

  const surfableToday = viableCandidates
    .filter((candidate) => isToday(candidate, now))
    .filter(isSurfable)
    .sort(byOverallScoreDesc);

  if (surfableToday.length > 0) {
    const items = surfableToday.map((candidate) => toItem(candidate, false));
    return {
      state: 'ready_today',
      generated_at: now.toISOString(),
      hero: items[0],
      items,
      watch_window: null,
      empty_state: {
        title: null,
        body: null,
        action_label: null,
      },
    };
  }

  const fallbackCandidates = viableCandidates
    .filter((candidate) => !isToday(candidate, now))
    .filter((candidate) => isWithinFallbackHorizon(candidate, now))
    .filter(isSurfable)
    .sort(byOverallScoreDesc);

  if (fallbackCandidates.length > 0) {
    const items = fallbackCandidates.map((candidate) => toItem(candidate, true));
    return {
      state: 'future_fallback',
      generated_at: now.toISOString(),
      hero: items[0],
      items,
      watch_window: null,
      empty_state: {
        title: null,
        body: null,
        action_label: null,
      },
    };
  }

  const closestWatch = viableCandidates
    .filter((candidate) => !isToday(candidate, now))
    .filter((candidate) => isWithinFallbackHorizon(candidate, now))
    .sort(byStartAsc)[0];

  return {
    state: 'no_good_window',
    generated_at: now.toISOString(),
    hero: null,
    items: [],
    watch_window: closestWatch ? toItem(closestWatch, true) : null,
    empty_state: {
      title: 'Nothing worth chasing for you right now',
      body: closestWatch
        ? 'The closest watch window is listed, but it still falls below your surfable threshold.'
        : 'Today and the next 72 hours are below your current surfable threshold.',
      action_label: closestWatch ? 'Watch this window' : 'Check back soon',
    },
  };
}

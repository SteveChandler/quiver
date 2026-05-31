import {
  RECOMMENDATIONS_V2_FALLBACK_HORIZON_HOURS,
  RECOMMENDATIONS_V2_MIN_CONDITION_SCORE,
  RECOMMENDATIONS_V2_MIN_PERSONAL_MATCH_SCORE,
  buildRecommendationsV2,
  type RecommendationV2Candidate,
} from '@/lib/services/discovery/recommendations-v2';

function candidate(
  overrides: Partial<RecommendationV2Candidate>,
): RecommendationV2Candidate {
  const start = overrides.window?.start ?? new Date('2026-05-31T15:00:00Z');
  const end = overrides.window?.end ?? new Date('2026-05-31T17:00:00Z');

  return {
    recommendationId: overrides.recommendationId ?? `rec-${overrides.beach?.id ?? 'beach'}`,
    beach: overrides.beach ?? {
      id: 'beach-1',
      name: 'HB Pier',
      lat: 33.65,
      lon: -118,
    },
    window: { start, end, timezone: 'America/Los_Angeles' },
    conditionScore: overrides.conditionScore ?? 78,
    personalMatchScore: overrides.personalMatchScore ?? 7.3,
    overallScore: overrides.overallScore ?? 82,
    label: overrides.label ?? 'GOOD',
    reasonType: overrides.reasonType ?? 'session_history',
    proofSummary: overrides.proofSummary ?? 'Similar to your 4-star HB Pier session in May.',
    evidenceFacts: overrides.evidenceFacts ?? [{ type: 'past_session', count: 1 }],
    sourceState: overrides.sourceState ?? 'learned',
    rankingPosition: overrides.rankingPosition ?? 1,
  };
}

describe('buildRecommendationsV2', () => {
  it('keeps a surfable today window ahead of a better far-future cached forecast', () => {
    const today = candidate({
      recommendationId: 'today',
      window: {
        start: new Date('2026-05-31T16:00:00Z'),
        end: new Date('2026-05-31T18:00:00Z'),
        timezone: 'America/Los_Angeles',
      },
      conditionScore: RECOMMENDATIONS_V2_MIN_CONDITION_SCORE,
      personalMatchScore: RECOMMENDATIONS_V2_MIN_PERSONAL_MATCH_SCORE,
      overallScore: 70,
      rankingPosition: 2,
    });
    const farFuture = candidate({
      recommendationId: 'far-future',
      window: {
        start: new Date('2026-06-10T16:00:00Z'),
        end: new Date('2026-06-10T18:00:00Z'),
        timezone: 'America/Los_Angeles',
      },
      conditionScore: 95,
      personalMatchScore: 9.2,
      overallScore: 96,
      rankingPosition: 1,
    });

    const result = buildRecommendationsV2({
      candidates: [farFuture, today],
      now: new Date('2026-05-31T14:00:00Z'),
    });

    expect(result.state).toBe('ready_today');
    expect(result.hero?.recommendation_id).toBe('today');
    expect(result.hero?.fallback_horizon_hours).toBeNull();
    expect(result.items.map((item) => item.recommendation_id)).toEqual([
      'today',
    ]);
  });

  it('uses the next 72 hours only when today fails the poor-window thresholds', () => {
    const poorToday = candidate({
      recommendationId: 'poor-today',
      window: {
        start: new Date('2026-05-31T16:00:00Z'),
        end: new Date('2026-05-31T18:00:00Z'),
        timezone: 'America/Los_Angeles',
      },
      conditionScore: RECOMMENDATIONS_V2_MIN_CONDITION_SCORE - 1,
      personalMatchScore: 8.1,
      overallScore: 64,
    });
    const futureGood = candidate({
      recommendationId: 'future-good',
      window: {
        start: new Date('2026-06-01T15:00:00Z'),
        end: new Date('2026-06-01T17:00:00Z'),
        timezone: 'America/Los_Angeles',
      },
      conditionScore: 82,
      personalMatchScore: 7.8,
      overallScore: 88,
    });

    const result = buildRecommendationsV2({
      candidates: [poorToday, futureGood],
      now: new Date('2026-05-31T14:00:00Z'),
    });

    expect(result.state).toBe('future_fallback');
    expect(result.hero?.recommendation_id).toBe('future-good');
    expect(result.hero?.fallback_horizon_hours).toBe(
      RECOMMENDATIONS_V2_FALLBACK_HORIZON_HOURS,
    );
    expect(result.hero?.fallback_reason).toBe('today_poor');
  });

  it('returns a no-good-window state with the closest watch window when today and 72 hours are poor', () => {
    const poorToday = candidate({
      recommendationId: 'poor-today',
      window: {
        start: new Date('2026-05-31T16:00:00Z'),
        end: new Date('2026-05-31T18:00:00Z'),
        timezone: 'America/Los_Angeles',
      },
      conditionScore: 40,
      personalMatchScore: 4.3,
      overallScore: 42,
    });
    const closestWatch = candidate({
      recommendationId: 'closest-watch',
      window: {
        start: new Date('2026-06-01T15:00:00Z'),
        end: new Date('2026-06-01T17:00:00Z'),
        timezone: 'America/Los_Angeles',
      },
      conditionScore: 55,
      personalMatchScore: 5.2,
      overallScore: 57,
    });

    const result = buildRecommendationsV2({
      candidates: [closestWatch, poorToday],
      now: new Date('2026-05-31T14:00:00Z'),
    });

    expect(result.state).toBe('no_good_window');
    expect(result.hero).toBeNull();
    expect(result.watch_window?.recommendation_id).toBe('closest-watch');
    expect(result.empty_state.title).toBe('Nothing worth chasing for you right now');
  });

  it('surfaces starter, avoidance-learning, low-confidence, and degraded source states', () => {
    const states = buildRecommendationsV2({
      candidates: [
        candidate({ recommendationId: 'starter', sourceState: 'starter_fit' }),
        candidate({ recommendationId: 'avoidance', sourceState: 'avoidance_learning' }),
        candidate({ recommendationId: 'low', sourceState: 'low_confidence' }),
        candidate({ recommendationId: 'degraded', sourceState: 'degraded' }),
      ],
      now: new Date('2026-05-31T14:00:00Z'),
    });

    expect(states.items.map((item) => item.source_state)).toEqual([
      'starter_fit',
      'avoidance_learning',
      'low_confidence',
      'degraded',
    ]);
  });
});

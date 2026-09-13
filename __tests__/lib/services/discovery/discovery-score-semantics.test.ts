/**
 * Regression cover for the discovery score split.
 *
 * Before this: the displayed score was condition + personalization + affinity +
 * distance + board-fit, clamped at 100. On a real account ten recommendations
 * came back and seven read exactly "Score 100" while their underlying condition
 * scores spread 87-97 — the number had stopped discriminating, the ranked list
 * showed ties it did not have, and a card could read "Score 100" beside the
 * verdict "Maybe".
 *
 * `score` is now conditions only (shared semantics with the verdict) and
 * ordering runs on an unclamped internal `rankingScore` that never ships.
 */
import {
  buildDiscoveryDisplayScore,
  computeWindowSlotScores,
  composeRankingScore,
  toDisplayConditionScore,
} from '@/lib/services/discovery/surf-discovery-orchestrator';
import { compareDiscoveryRecommendations } from '@/lib/services/discovery/distance-friction';
import { stripInternalRankingScore } from '@/app/api/surf/discover/route';
import type { SurfDiscoveryRecommendation, SurfDiscoveryResponse } from '@/types/personalization';

import snapshot from '@/__tests__/fixtures/grandview-crossing-swells-20260911.json';
import { scoreNativeForecastSlot } from '@/lib/scoring/native-condition-score';
import { scoreWindowConditionScore } from '@/lib/services/discovery/window-selector/window-scorer';
import { createDiscoveryScoringEngine } from '@/lib/domains/scoring';
import { getRecommendationLabel } from '@/lib/services/discovery/response-formatter';
import type { BoardClass } from '@/lib/domains/rideability';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

type Rankable = Pick<
  SurfDiscoveryRecommendation,
  'score' | 'rankingScore' | 'distanceMiles'
>;

const rec = (
  score: number,
  rankingScore?: number,
  distanceMiles = 5,
): Rankable => ({ score, rankingScore, distanceMiles });

describe('displayed condition score', () => {
  it('is the condition score, untouched by personalization', () => {
    // The bonus that used to be folded in is +12 for a personalized user.
    expect(toDisplayConditionScore(88)).toBe(88);
    expect(toDisplayConditionScore(97)).toBe(97);
  });

  it('keeps two differently-conditioned spots distinguishable', () => {
    // The exact production case: 88 and 97 both rendered as 100.
    const weaker = toDisplayConditionScore(88);
    const stronger = toDisplayConditionScore(97);

    expect(weaker).not.toBe(stronger);
    expect(stronger).toBeGreaterThan(weaker);
    expect([weaker, stronger].some((s) => s === 100)).toBe(false);
  });

  it('still honours the 0-100 display scale at the edges', () => {
    expect(toDisplayConditionScore(140)).toBe(100);
    expect(toDisplayConditionScore(-20)).toBe(0);
  });
});

describe('internal ranking score', () => {
  it('keeps personalization as an ordering input', () => {
    const plain = composeRankingScore({
      conditionScore: 88,
      affinityBonus: 0,
      distancePenalty: 0,
      personalizationBonus: 0,
      boardStyleFitPoints: 0,
    });
    const personalized = composeRankingScore({
      conditionScore: 88,
      affinityBonus: 0,
      distancePenalty: 0,
      personalizationBonus: 12,
      boardStyleFitPoints: 0,
    });

    expect(personalized).toBeGreaterThan(plain);
  });

  it('does not saturate at 100, so bonuses keep separating spots', () => {
    const a = composeRankingScore({
      conditionScore: 88,
      affinityBonus: 0,
      distancePenalty: 0,
      personalizationBonus: 12,
      boardStyleFitPoints: 0,
    });
    const b = composeRankingScore({
      conditionScore: 97,
      affinityBonus: 0,
      distancePenalty: 0,
      personalizationBonus: 12,
      boardStyleFitPoints: 0,
    });

    // Under the old clamp both were capped to exactly 100 — an artificial tie
    // between an 88-condition spot and a 97-condition one. Unclamped, the
    // stronger spot stays ahead and at least one value now exceeds the ceiling.
    expect(a).toBe(100);
    expect(b).toBe(109);
    expect(b).toBeGreaterThan(100);
    expect(a).not.toBe(b);
  });

  it('subtracts distance friction rather than clamping it away', () => {
    const near = composeRankingScore({
      conditionScore: 95, affinityBonus: 0, distancePenalty: 0,
      personalizationBonus: 12, boardStyleFitPoints: 0,
    });
    const far = composeRankingScore({
      conditionScore: 95, affinityBonus: 0, distancePenalty: -20,
      personalizationBonus: 12, boardStyleFitPoints: 0,
    });

    expect(far).toBeLessThan(near);
  });
});

describe('ordering', () => {
  it('ranks on the ranking score, not the displayed score', () => {
    // Equal display scores; personalization separates them.
    const preferred = rec(88, 100);
    const other = rec(88, 88);

    expect(compareDiscoveryRecommendations(preferred, other)).toBeLessThan(0);
  });

  it('no longer produces artificial ties between saturating spots', () => {
    const good = rec(88, 100);
    const better = rec(97, 109);

    // Under the old clamp both ranked at exactly 100 and order was arbitrary.
    expect(compareDiscoveryRecommendations(better, good)).toBeLessThan(0);
    expect(compareDiscoveryRecommendations(good, better)).toBeGreaterThan(0);
  });

  it('sorts a realistic pool by merit rather than leaving it flat', () => {
    const pool: Rankable[] = [
      rec(88, 100, 4),
      rec(97, 109, 6),
      rec(90, 102, 5),
    ];

    const ordered = [...pool].sort(compareDiscoveryRecommendations);
    const displayed = ordered.map((r) => r.score);

    expect(displayed).toEqual([97, 90, 88]);
    expect(new Set(displayed).size).toBe(3);
  });

  it('falls back to the displayed score when no ranking score is present', () => {
    const higher = rec(90, undefined);
    const lower = rec(70, undefined);

    expect(compareDiscoveryRecommendations(higher, lower)).toBeLessThan(0);
  });
});

describe('verdict consistency', () => {
  // The verdict is derived from the same condition score the card prints, so
  // the two cannot disagree the way "Score 100 · Maybe" did.
  const verdictFor = (score: number): string =>
    score >= 75 ? 'Worth it' : score >= 50 ? 'Maybe' : 'Skip';

  it('does not let personalization promote the number past its own verdict', () => {
    const conditionScore = 62; // genuinely middling conditions
    const displayed = toDisplayConditionScore(conditionScore);
    const ranking = composeRankingScore({
      conditionScore,
      affinityBonus: 0,
      distancePenalty: 0,
      personalizationBonus: 12,
      boardStyleFitPoints: 0,
    });

    expect(verdictFor(displayed)).toBe('Maybe');
    // Ranking may be boosted, but the printed number stays with the verdict.
    expect(ranking).toBeGreaterThan(displayed);
    expect(displayed).toBe(62);
  });

  it('keeps a strong-conditions spot coherent as well', () => {
    const displayed = toDisplayConditionScore(91);
    expect(verdictFor(displayed)).toBe('Worth it');
    expect(displayed).toBe(91);
  });
});

describe('API mapping', () => {
  const response = (
    recs: Array<Partial<SurfDiscoveryRecommendation>>,
    included?: Array<Partial<SurfDiscoveryRecommendation>>,
  ): SurfDiscoveryResponse =>
    ({
      recommendations: recs,
      includedRecommendations: included,
    } as unknown as SurfDiscoveryResponse);

  it('never ships the internal ranking score to clients', () => {
    const out = stripInternalRankingScore(
      response([{ score: 88, rankingScore: 100 }]),
    );

    expect(out.recommendations[0]).not.toHaveProperty('rankingScore');
    expect(out.recommendations[0].score).toBe(88);
  });

  it('strips it from included recommendations too', () => {
    const out = stripInternalRankingScore(
      response([{ score: 88, rankingScore: 100 }], [{ score: 70, rankingScore: 82 }]),
    );

    expect(out.includedRecommendations?.[0]).not.toHaveProperty('rankingScore');
    expect(out.includedRecommendations?.[0].score).toBe(70);
  });

  it('leaves a response without included recommendations intact', () => {
    const out = stripInternalRankingScore(response([{ score: 88, rankingScore: 100 }]));

    expect(out.includedRecommendations).toBeUndefined();
    expect(out.recommendations).toHaveLength(1);
  });
});

describe('Grandview crossing-swells regression', () => {
  it.each<[BoardClass[]]>([[[]], [['mid-length']]])('keeps displayed, window, and hourly ratings within the same ceiling with boards %j', (boardClasses) => {
    const beach = snapshot.beach as unknown as Beach;
    const forecast = snapshot.forecast as EnhancedForecastEntity;
    expect(beach).not.toHaveProperty('bottom_type');
    expect(scoreNativeForecastSlot(forecast, 'intermediate')).toBeGreaterThanOrEqual(80);
    const windowScore = scoreWindowConditionScore(forecast, beach, 'intermediate', null, boardClasses);
    expect(windowScore).toBe(65);
    const display = buildDiscoveryDisplayScore({
      beach, forecast, userSkillLevel: 'intermediate', boardClasses,
      affinityBonus: 0, distancePenalty: 0, personalizationBonus: 0, boardStyleFitPoints: 0,
    });
    expect(display.total).toBe(windowScore);
    expect(getRecommendationLabel(display.total)).toBe('Maybe');
    const cleanForecast = { ...forecast, swell_2_direction: forecast.swell_1_direction };
    const cleanDisplay = buildDiscoveryDisplayScore({
      beach, forecast: cleanForecast, userSkillLevel: 'intermediate', boardClasses,
      affinityBonus: 0, distancePenalty: 0, personalizationBonus: 0, boardStyleFitPoints: 0,
    });
    expect(cleanDisplay.total).toBeGreaterThanOrEqual(80);
    expect(getRecommendationLabel(cleanDisplay.total)).toBe('Worth it');
    expect(computeWindowSlotScores({ beach, window: snapshot.window } as unknown as SurfDiscoveryRecommendation,
      [forecast], createDiscoveryScoringEngine(), 'intermediate', boardClasses)).toEqual([windowScore]);
  });
});

import type { SurfDiscoveryRecommendation, StrategyTag, StrategyTagType } from '@/types/personalization';

const TAG_LABELS: Record<StrategyTagType, string> = {
  biggest_waves: 'Biggest waves',
  cleanest: 'Cleanest',
  sleep_in: 'Sleep-in friendly',
  low_crowd: 'Low crowd',
  skip: 'Skip',
};

/**
 * Assign at most one strategy tag per non-hero recommendation.
 * Mutates the input array's strategyTag fields and returns it.
 */
export function assignStrategyTags(
  recs: SurfDiscoveryRecommendation[],
  sleepInScores?: Map<string, number>,
): SurfDiscoveryRecommendation[] {
  if (recs.length <= 1) return recs;

  const hero = recs[0];
  const candidates = recs.slice(1);
  const taggedBeaches = new Set<string>();

  // --- biggest_waves: highest waveHeightFit AND exceeds hero ---
  const biggestCandidate = candidates
    .filter(r => r.subscores.waveHeightFit > hero.subscores.waveHeightFit)
    .sort((a, b) => b.subscores.waveHeightFit - a.subscores.waveHeightFit)[0];

  if (biggestCandidate) {
    biggestCandidate.strategyTag = {
      type: 'biggest_waves',
      label: TAG_LABELS.biggest_waves,
      reason: buildReason(biggestCandidate),
    };
    taggedBeaches.add(biggestCandidate.beach.id);
  }

  // --- cleanest: highest windAlignment >= 16 ---
  const cleanestCandidate = candidates
    .filter(r => !taggedBeaches.has(r.beach.id) && r.subscores.windAlignment >= 16)
    .sort((a, b) => b.subscores.windAlignment - a.subscores.windAlignment)[0];

  if (cleanestCandidate) {
    cleanestCandidate.strategyTag = {
      type: 'cleanest',
      label: TAG_LABELS.cleanest,
      reason: buildReason(cleanestCandidate),
    };
    taggedBeaches.add(cleanestCandidate.beach.id);
  }

  // --- low_crowd: crowd_level light/moderate AND score >= 40 ---
  const lowCrowdCandidate = candidates
    .filter(r => {
      if (taggedBeaches.has(r.beach.id)) return false;
      if (r.score < 40) return false;
      const crowd = r.beach.crowd_level;
      return crowd === 'light' || crowd === 'moderate';
    })
    .sort((a, b) => b.score - a.score)[0];

  if (lowCrowdCandidate) {
    lowCrowdCandidate.strategyTag = {
      type: 'low_crowd',
      label: TAG_LABELS.low_crowd,
      reason: buildReason(lowCrowdCandidate),
    };
    taggedBeaches.add(lowCrowdCandidate.beach.id);
  }

  // --- sleep_in: retains >= 70% score with 9am+ filter ---
  if (sleepInScores) {
    const sleepInCandidate = candidates
      .filter(r => {
        if (taggedBeaches.has(r.beach.id)) return false;
        const lateScore = sleepInScores.get(r.beach.id);
        if (lateScore == null) return false;
        return lateScore >= r.score * 0.7;
      })
      .sort((a, b) => b.score - a.score)[0];

    if (sleepInCandidate) {
      sleepInCandidate.strategyTag = {
        type: 'sleep_in',
        label: TAG_LABELS.sleep_in,
        reason: `Holds ${sleepInCandidate.waveHeightBadge ?? 'size'} past 9am`,
      };
      taggedBeaches.add(sleepInCandidate.beach.id);
    }
  }

  // --- skip: score < 40 (multiple allowed) ---
  for (const rec of candidates) {
    if (!taggedBeaches.has(rec.beach.id) && rec.score < 40) {
      rec.strategyTag = {
        type: 'skip',
        label: TAG_LABELS.skip,
        reason: rec.warnings[0] ?? 'Conditions not favorable',
      };
    }
  }

  return recs;
}

function buildReason(rec: SurfDiscoveryRecommendation): string {
  const parts: string[] = [];
  const forecast = rec.forecast;

  if (forecast.wind_speed) {
    if (/^0(\s|$|[^.])/i.test(forecast.wind_speed ?? '')) {
      parts.push('Glassy');
    } else if (forecast.wind_direction) {
      parts.push(`${forecast.wind_speed} ${forecast.wind_direction}`);
    }
  }

  if (forecast.swell_1_period && forecast.swell_1_direction) {
    parts.push(`${forecast.swell_1_period} ${forecast.swell_1_direction}`);
  }

  return parts.join(' · ') || rec.summary;
}

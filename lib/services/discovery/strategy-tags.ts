import type { SurfDiscoveryRecommendation, StrategyTag, StrategyTagType } from '@/types/personalization';
import { getHourInTimezone } from '@/lib/utils/date-time';

const TAG_LABELS: Record<StrategyTagType, string> = {
  biggest_waves: 'Biggest waves',
  cleanest: 'Cleanest',
  sleep_in: 'Sleep-in friendly',
  low_crowd: 'Low crowd',
  skip: 'Skip',
};

/** Hour after which the sleep_in tag becomes meaningless ("Holds past 9am" — once it's 9am, this isn't a useful framing). */
const SLEEP_IN_CUTOFF_HOUR = 9;

/**
 * Assign at most one strategy tag per non-hero recommendation.
 * Mutates the input array's strategyTag fields and returns it.
 *
 * @param now Reference time for time-of-day-sensitive tags (defaults to Date.now()).
 *            Lets sleep_in suppress itself once it's already past the cutoff hour.
 */
export function assignStrategyTags(
  recs: SurfDiscoveryRecommendation[],
  sleepInScores?: Map<string, number>,
  now: Date = new Date(),
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
  // Suppress entirely once it's already past 9am at the candidate's beach.
  // The reason copy ("Holds … past 9am") and badge are both morning-relative;
  // showing them in the afternoon is the bug Steven reported 2026-04-27.
  if (sleepInScores) {
    const sleepInCandidate = candidates
      .filter(r => {
        if (taggedBeaches.has(r.beach.id)) return false;
        const lateScore = sleepInScores.get(r.beach.id);
        if (lateScore == null) return false;
        if (lateScore < r.score * 0.7) return false;
        const tz = r.window.timezone || 'America/Los_Angeles';
        return getHourInTimezone(now, tz) < SLEEP_IN_CUTOFF_HOUR;
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

  // Prefer wave_period / wave_direction — already the dominant partition per
  // forecast-builder. swell_1_* is the legacy fallback for rows that predate
  // the dominant-write path. Reading raw swell_1 here would emit "14s SSW" in
  // the strategy reason on a windswell-dominant day even though the verdict
  // was scored on the actual 6s W dominant.
  const reasonPeriod = forecast.wave_period ?? forecast.swell_1_period;
  const reasonDirection = forecast.wave_direction ?? forecast.swell_1_direction;
  if (reasonPeriod && reasonDirection) {
    parts.push(`${reasonPeriod} ${reasonDirection}`);
  }

  return parts.join(' · ') || rec.summary;
}

/**
 * Condition Character Classifier (Domain Engine)
 *
 * Ports the legacy `getConditionCharacter()` decision tree from
 * `lib/scoring/surf-conditions-scorer.ts` onto the new domain-driven
 * inputs (ConditionsSnapshot, SpotProfile, CompositeScore).
 *
 * BEHAVIOUR-PRESERVING: same inputs MUST produce the same `category`
 * + `label` strings as the legacy classifier. The scoring numbers
 * change (legacy subscores are 0-25/0-20/0-20/0-15; new engine
 * subscores are 0-100), but the qualitative classification does not.
 *
 * THRESHOLD TRANSLATION (legacy → domain engine):
 *   - Legacy `subscores.windAlignment >= 14` (70% of MAX_WIND_ALIGNMENT=20)
 *     becomes `(composite.subscores.get('windQuality') ?? 0) >= 70`.
 *   - Legacy `subscores.tideFit >= 11` (~70% of MAX_TIDE_FIT=15)
 *     becomes `(composite.subscores.get('tideFit') ?? 0) >= 70`.
 *   - Legacy `subscores.windAlignment >= 12` (60% of MAX_WIND_ALIGNMENT=20,
 *     used for the large-clean branch) becomes `... >= 60`.
 *
 * WIND THRESHOLD DEFAULTS — behaviour preservation note:
 *   The legacy classifier hard-coded 25 mph (max wind any) and 10 mph
 *   (max onshore wind) as its skip thresholds because `max_wind_any_mph`
 *   and `max_wind_onshore_mph` are not DB columns — `BeachWithThresholds`
 *   carried them as TS-only fields that always fell back to default.
 *
 *   The new `SpotProfile.windThresholds` derives `maxOnshoreMph` from the
 *   real DB column `wind_onshore_bad_kt` (knots → mph), and `maxAnyMph`
 *   defaults to 18. Both diverge from the legacy 25/10 for many beaches.
 *
 *   To stay behaviour-preserving in PR 2, we deliberately ignore
 *   `profile.windThresholds` for the skip-gate thresholds and use the
 *   legacy 25/10 constants directly. PR 4 (wind tier rework) consolidates
 *   the threshold semantics into the wind-quality scorer and removes
 *   this divergence.
 *
 * Priority-ordered decision tree (first match wins):
 *   skip → flat → small (weak/quality/clean) → medium (clean/mixed)
 *        → large (clean/rough)
 */

import type { ConditionsSnapshot } from '../conditions/types';
import type { SpotProfile } from '../spot-profile/types';
import type { CompositeScore } from './types';
import { angleDifference } from '../shared';

/**
 * Condition character categories (mirrors legacy `lib/scoring/types.ts`).
 */
export type ConditionCharacterCategory =
  | 'flat'
  | 'small-weak'
  | 'small-quality'
  | 'small-clean'
  | 'medium-clean'
  | 'medium-mixed'
  | 'large-clean'
  | 'large-rough'
  | 'skip';

/**
 * Human-readable condition character with category and display label.
 * Re-export of the legacy shape so consumers can migrate one type at a time.
 */
export interface ConditionCharacter {
  /** Short descriptive label, e.g. "Small but powerful — long-period energy" */
  label: string;
  category: ConditionCharacterCategory;
}

/**
 * Legacy skip-gate thresholds — used unconditionally to stay
 * behaviour-preserving with `lib/scoring/surf-conditions-scorer.ts:25-27`.
 * See file header for rationale.
 */
const LEGACY_MAX_WIND_ANY_MPH = 25;
const LEGACY_MAX_WIND_ONSHORE_MPH = 10;

/**
 * Subscore thresholds in the new 0-100 space (translated from legacy
 * 0-20/0-15 fractions — see file header for the full mapping).
 */
const WIND_QUALITY_GOOD_THRESHOLD = 70;
const WIND_QUALITY_CLEAN_THRESHOLD = 60;
const TIDE_FIT_GOOD_THRESHOLD = 70;

/**
 * Calculate angular fit between a swell direction and the spot's swell window.
 *
 * Ported from legacy `calculateSwellDirectionFit` so the small-quality branch
 * preserves identical thresholds (`directionFit >= 0.85` and `>= 0.4`).
 *
 * Returns 0.0 (worst) to 1.0 (ideal). Uses the SpotProfile's pre-computed
 * `centerDeg` + `halfWidthDeg`.
 *
 * Algorithm (matches legacy):
 *   - 0.5 fallback when direction is null
 *   - 1.0 when |swell − center| ≤ halfwidth
 *   - Linear decay over 75° beyond halfwidth, clamped to 0
 */
function calculateSwellDirectionFit(
  swellDirection: number | null,
  profile: SpotProfile
): number {
  if (swellDirection == null) return 0.5;

  const { centerDeg, halfWidthDeg } = profile.swellWindow;
  // Note: SpotProfile always has center/halfwidth (defaults to full circle
  // 180° halfwidth when DB is null), so the legacy "no window configured"
  // 0.5 fallback is implicitly handled by the full-circle default.
  const diff = angleDifference(swellDirection, centerDeg);

  if (diff <= halfWidthDeg) return 1.0;

  const decayRange = 75; // degrees of decay past halfwidth (matches legacy)
  const excess = diff - halfWidthDeg;
  const fit = Math.max(0, 1.0 - excess / decayRange);
  return parseFloat(fit.toFixed(4));
}

/**
 * Check if wind is onshore for character classification.
 *
 * Ported from legacy `isWindOnshoreForCharacter`. Onshore is defined as
 * within `tolerance` of the pure onshore direction (180° from offshore),
 * which is narrower than the wind-quality scorer's three-tier classification.
 */
function isWindOnshoreForCharacter(
  windSpeed: number,
  windDirection: number | null,
  profile: SpotProfile
): boolean {
  if (windDirection === null) return false;
  const { offshoreDeg, offshoreToleranceDeg } = profile.windThresholds;
  const onshoreDir = (offshoreDeg + 180) % 360;
  return (
    windSpeed > 0 &&
    angleDifference(windDirection, onshoreDir) <= offshoreToleranceDeg
  );
}

/**
 * Determine the qualitative condition character.
 *
 * Priority-ordered decision tree (first matching rule wins):
 *   1. Skip — blown out or dominated by onshore wind
 *   2. Flat — barely anything to surf (< 0.5ft)
 *   3. Small (0.5–2ft) — weak / quality / clean / fallback
 *   4. Medium (2–5ft) — clean / mixed
 *   5. Large (5ft+) — clean / rough
 *
 * @param snapshot - Current conditions snapshot (wave, wind, etc.)
 * @param profile - Spot profile (offshore direction, swell window, break type)
 * @param composite - Already-computed composite score (0-100 subscores)
 * @returns ConditionCharacter with category + display label
 */
export function getConditionCharacter(
  snapshot: ConditionsSnapshot,
  profile: SpotProfile,
  composite: CompositeScore
): ConditionCharacter {
  const waveHeight = snapshot.waveHeight;
  const wavePeriod = snapshot.wavePeriod;
  const windSpeed = snapshot.wind.speedMph;
  const windDirection = snapshot.wind.directionDeg;

  // Use the legacy 25/10 skip-gate thresholds unconditionally so character
  // classification stays behaviour-preserving across the migration.
  // SpotProfile.windThresholds derives maxOnshoreMph from wind_onshore_bad_kt,
  // which would shift the skip gate for any beach with that column set.
  const maxWindAny = LEGACY_MAX_WIND_ANY_MPH;
  const maxWindOnshore = LEGACY_MAX_WIND_ONSHORE_MPH;

  const isOnshore = isWindOnshoreForCharacter(windSpeed, windDirection, profile);

  // 1. Skip conditions — blown out or dominated by onshore wind
  if (windSpeed > maxWindAny) {
    return { category: 'skip', label: 'Blown out — too much wind' };
  }
  if (isOnshore && windSpeed > maxWindOnshore) {
    return { category: 'skip', label: 'Onshore wind — conditions blown out' };
  }

  // 2. Flat — barely anything to surf
  if (waveHeight < 0.5) {
    return { category: 'flat', label: 'Flat — rest day' };
  }

  // 3. Small waves (0.5–2ft)
  if (waveHeight < 2) {
    // Small-weak: short period wind chop (checked early, like legacy)
    if (wavePeriod < 8) {
      if (isOnshore && windSpeed > 5) {
        return { category: 'small-weak', label: 'Small & choppy — onshore wind' };
      }
      return { category: 'small-weak', label: 'Weak swell — minimal energy' };
    }

    // Small-quality: long period + good direction alignment
    if (wavePeriod >= 12) {
      // Resolve a swell direction in the same priority order legacy used:
      // primary swell first, then overall wave direction.
      const swellDirection =
        snapshot.primarySwell?.directionDeg ?? snapshot.waveDirection ?? null;
      const directionFit = calculateSwellDirectionFit(swellDirection, profile);
      if (directionFit >= 0.85) {
        return {
          category: 'small-quality',
          label: 'Small but powerful — long-period energy',
        };
      }
      if (directionFit >= 0.4) {
        return {
          category: 'small-quality',
          label: 'Small with some push — angled swell',
        };
      }
    }

    // Small-clean: light wind, not onshore (8s+ period)
    if (windSpeed <= 5 && !isOnshore) {
      return { category: 'small-clean', label: 'Small & clean — glassy conditions' };
    }

    // Small-weak: onshore wind (8-11s period)
    if (isOnshore && windSpeed > 5) {
      return { category: 'small-weak', label: 'Small & choppy — onshore wind' };
    }

    // Catch-all small fallback
    return { category: 'small-weak', label: 'Small — marginal conditions' };
  }

  // 4. Medium waves (2–5ft)
  const windQuality = composite.subscores.get('windQuality') ?? 0;
  const tideFit = composite.subscores.get('tideFit') ?? 0;

  if (waveHeight < 5) {
    const windIsGood = windQuality >= WIND_QUALITY_GOOD_THRESHOLD;
    const tideIsGood = tideFit >= TIDE_FIT_GOOD_THRESHOLD;
    if (windIsGood && tideIsGood && wavePeriod >= 10) {
      return { category: 'medium-clean', label: "Dialed — everything's lining up" };
    }
    return { category: 'medium-mixed', label: 'Decent — some quality in the mix' };
  }

  // 5. Large waves (5ft+)
  const windIsClean = windQuality >= WIND_QUALITY_CLEAN_THRESHOLD;
  if (windIsClean && wavePeriod >= 10) {
    return { category: 'large-clean', label: 'Firing — overhead and clean' };
  }
  return { category: 'large-rough', label: 'Big and rough — experts only' };
}

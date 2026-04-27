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
 * WIND SKIP-GATE OWNERSHIP (PR 4):
 *   Skip semantics now flow entirely through `windQualityScorer`'s tier
 *   table — when the scorer returns `skip = true` (Blown-out tier: ≥22 mph
 *   onshore-or-cross OR ≥30 mph offshore), the composite carries that
 *   skip reason and the classifier reads `skipReason` directly instead of
 *   re-deriving thresholds. The legacy 25/10 hard-coded constants from
 *   `lib/scoring/surf-conditions-scorer.ts` are intentionally NOT mirrored
 *   here — see PR 4 commit body for the consolidation rationale.
 *
 * Priority-ordered decision tree (first match wins):
 *   skip → flat → small (weak/quality/clean)
 *        → medium (clean/mixed/rough)
 *        → large (clean/rough)
 */

import type { ConditionsSnapshot } from '../conditions/types';
import type { SpotProfile } from '../spot-profile/types';
import type { CompositeScore } from './types';
import { angleDifference } from '../shared';

/**
 * Condition character categories (mirrors legacy `lib/scoring/types.ts`).
 *
 * `medium-rough` was introduced in PR 4 — it sits between `medium-mixed` and
 * `skip` for 2-5 ft days where the wind-quality subscore has cratered the
 * recommendation but the swell is still rideable on paper. Used to gate
 * `recommendationLabel` so a 75-ish score in the excellent band can still
 * downgrade to `Maybe` when the wind is bad.
 */
export type ConditionCharacterCategory =
  | 'flat'
  | 'small-weak'
  | 'small-quality'
  | 'small-clean'
  | 'medium-clean'
  | 'medium-mixed'
  | 'medium-rough'
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
 * Subscore thresholds in the new 0-100 space (translated from legacy
 * 0-20/0-15 fractions — see file header for the full mapping).
 *
 * `WIND_QUALITY_ROUGH_THRESHOLD` is the PR 4 tier-rework gate that
 * separates `medium-mixed` from `medium-rough`. Tuned against the
 * Horseshoe (windQuality ~60 at 10mph cross / 13s / 2.3ft → still
 * `medium-mixed`) and OB Pier (windQuality ~22 at 12mph onshore / 6s /
 * 1.4ft → small bucket, never reaches medium classifier) scenarios.
 */
const WIND_QUALITY_GOOD_THRESHOLD = 70;
const WIND_QUALITY_CLEAN_THRESHOLD = 60;
const WIND_QUALITY_ROUGH_THRESHOLD = 30;
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

  const isOnshore = isWindOnshoreForCharacter(windSpeed, windDirection, profile);

  // 1. Skip conditions — read the composite's skip reason directly. The
  //    `windQualityScorer` (post-PR 4) raises `skip` only at the Blown-out
  //    tier (≥22 mph onshore-or-cross OR ≥30 mph offshore), which is the
  //    new single source of truth for "too windy to surf". Skip from any
  //    other scorer (e.g. `baseConditionsScorer` for >25 ft) also lands
  //    here — surface a generic blown-out label since wind is the most
  //    common cause; downstream callers display the composite's actual
  //    skipReason when more detail is needed.
  if (composite.skipReason) {
    const lower = composite.skipReason.toLowerCase();
    const label = lower.includes('onshore')
      ? 'Onshore wind — conditions blown out'
      : 'Blown out — too much wind';
    return { category: 'skip', label };
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
    if (windQuality < WIND_QUALITY_ROUGH_THRESHOLD) {
      return {
        category: 'medium-rough',
        label: 'Mixed and choppy — wind-affected',
      };
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

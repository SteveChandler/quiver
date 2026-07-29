/**
 * Pre-forecast preference fit for candidate-pool ordering.
 *
 * The candidate pool is chosen BEFORE any forecast is fetched, so nothing here
 * may look at conditions. Only static beach columns and the user's stored
 * profile are available.
 *
 * Fit is expressed as a **detour budget in miles** rather than an abstract
 * score: a perfectly-matched spot is ranked as if it were
 * `PREFERENCE_DETOUR_BUDGET_MILES` closer than it actually is. Keeping distance
 * as the ranking unit is the whole point — preference reorders spots that are
 * at comparable distance, but it can never let a far spot leapfrog a near one
 * by more than the budget. A style match is worth a short detour, not a
 * road trip.
 *
 * @module lib/services/discovery/candidate-pool-fit
 */

import type { SkillLevel } from '@/lib/domains/user-preferences';
import { normalizeBoardClass, type BoardClass } from '@/lib/domains/rideability';

/**
 * How many miles of extra drive a perfect preference match is worth.
 *
 * Sized so preference can reshuffle a metro-area cluster (most coastal metros
 * pack 20+ spots into a 12-mile stretch) without ever promoting a genuinely
 * distant spot over a good local one.
 */
export const PREFERENCE_DETOUR_BUDGET_MILES = 12;

/** Neutral fit for a signal we have no data for — never rewards or punishes. */
const NEUTRAL = 0.5;

const SKILL_WEIGHT = 0.45;
const STYLE_WEIGHT = 0.35;
const QUALITY_WEIGHT = 0.2;

/** The user's stored preferences, as far as the pre-forecast stage can see. */
export interface PoolPreferenceProfile {
  /** `profiles.experience_level`, already parsed. */
  skillLevel: SkillLevel | null;
  /** `profiles.surf_styles` (longboard, shortboard, …). */
  surfStyles: readonly string[];
}

/** The static beach columns pool fit is allowed to read. */
export interface PoolFitBeach {
  skill_level?: string | null;
  break_type?: string | null;
  average_rating?: number | null;
}

/**
 * Skill bands on a shared 0–3 scale (beginner → expert) so beach ratings and
 * user experience levels can be compared directly. Beach `skill_level` is free
 * text with compound values ("beginner-intermediate", "upper-intermediate"),
 * which is why these land on half-steps.
 */
const USER_SKILL_BAND: Record<SkillLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

function beachSkillBand(rawSkillLevel: string | null | undefined): number | null {
  if (!rawSkillLevel) return null;
  const value = rawSkillLevel.trim().toLowerCase();
  if (!value) return null;

  // Order matters: compound values contain their component words.
  if (value.includes('expert')) return 3;
  if (value.includes('beginner') && value.includes('intermediate')) return 0.5;
  if (value.includes('lower-intermediate')) return 0.5;
  if (value.includes('upper-intermediate')) return 1.5;
  if (value.includes('intermediate') && value.includes('advanced')) return 1.5;
  if (value.includes('intermediate')) return 1;
  if (value.includes('advanced')) return 2;
  if (value.includes('beginner')) return 0;
  return null;
}

/**
 * Overshoot (spot harder than the surfer) is penalised at full weight;
 * undershoot (spot easier) at a discount. Paddling out somewhere mellow is a
 * mild mismatch, paddling out somewhere over your head is not.
 */
const UNDERSHOOT_DISCOUNT = 0.6;
const SKILL_BANDS_TO_ZERO_FIT = 2;

function skillFit(beach: PoolFitBeach, profile: PoolPreferenceProfile): number {
  const userBand = profile.skillLevel ? USER_SKILL_BAND[profile.skillLevel] : null;
  const spotBand = beachSkillBand(beach.skill_level);
  if (userBand === null || spotBand === null) return NEUTRAL;

  const rawGap = spotBand - userBand;
  const weightedGap = rawGap >= 0 ? rawGap : Math.abs(rawGap) * UNDERSHOOT_DISCOUNT;
  return 1 - clamp01(weightedGap / SKILL_BANDS_TO_ZERO_FIT);
}

/**
 * Break types each board class tends to seek out. Deliberately coarse — this
 * only decides which spots are worth *scoring*, not which one gets recommended.
 *
 * Keyed on `BoardClass` and fed through `normalizeBoardClass` because
 * `profiles.surf_styles` is written by two clients with different vocabularies
 * (web offers funboard/sup, native adds foamie/midlength/fish).
 */
const STYLE_BREAK_AFFINITY: Record<BoardClass, readonly string[]> = {
  foamie: ['beach'],
  longboard: ['point', 'beach'],
  'mid-length': ['point', 'beach'],
  funboard: ['beach', 'point'],
  fish: ['beach', 'point'],
  shortboard: ['reef', 'jetty', 'point'],
  'step-up': ['reef', 'point'],
  gun: ['reef', 'point'],
  sup: ['point', 'beach'],
  foil: ['point', 'beach'],
  bodyboard: ['beach', 'jetty', 'pier'],
};

/**
 * `beaches.break_type` is free text and sometimes compound
 * ("beach/reef break", "jetty/beach"), so split it into tokens.
 */
function breakTypeTokens(rawBreakType: string | null | undefined): string[] {
  if (!rawBreakType) return [];
  return rawBreakType
    .toLowerCase()
    .split(/[/,+]/)
    .map((token) => token.replace(/\bbreaks?\b/g, '').trim())
    .filter(Boolean);
}

function styleFit(beach: PoolFitBeach, profile: PoolPreferenceProfile): number {
  const tokens = breakTypeTokens(beach.break_type);
  if (tokens.length === 0) return NEUTRAL;

  const wanted = new Set(
    profile.surfStyles.flatMap((style) => {
      const boardClass = normalizeBoardClass(style);
      return boardClass ? STYLE_BREAK_AFFINITY[boardClass] : [];
    })
  );
  if (wanted.size === 0) return NEUTRAL;

  return tokens.some((token) => wanted.has(token)) ? 1 : 0;
}

/**
 * Editorial quality, used only as a low-weight tiebreaker between spots the
 * preference signals rate equally. Ratings bunch in the 3–5 range, so 3.0 is
 * treated as the floor.
 */
const QUALITY_RATING_FLOOR = 3;
const QUALITY_RATING_CEILING = 5;

function qualityFit(beach: PoolFitBeach): number {
  const rating = beach.average_rating;
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return NEUTRAL;
  return clamp01(
    (rating - QUALITY_RATING_FLOOR) / (QUALITY_RATING_CEILING - QUALITY_RATING_FLOOR)
  );
}

/**
 * Blended pre-forecast fit in [0, 1]. Every signal falls back to 0.5, so a user
 * with an empty profile gets a uniform 0.5 across the pool — an order-preserving
 * shift, i.e. pure distance ordering, exactly as before.
 */
export function preferenceFit(
  beach: PoolFitBeach,
  profile: PoolPreferenceProfile
): number {
  return clamp01(
    skillFit(beach, profile) * SKILL_WEIGHT +
      styleFit(beach, profile) * STYLE_WEIGHT +
      qualityFit(beach) * QUALITY_WEIGHT
  );
}

/**
 * Distance the pool ranks on: real miles minus the detour a match has earned.
 * Can go negative for a perfectly-matched spot inside the budget; that is fine,
 * it only ever competes against other effective distances.
 */
export function effectiveDistanceMiles(
  distanceMiles: number,
  fit: number
): number {
  const miles = Number.isFinite(distanceMiles) ? distanceMiles : Number.MAX_SAFE_INTEGER;
  return miles - PREFERENCE_DETOUR_BUDGET_MILES * clamp01(fit);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

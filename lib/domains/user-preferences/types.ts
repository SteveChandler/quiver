/**
 * User Preferences Domain Types
 *
 * Aggregates all user preference data for scoring:
 * - Explicit preferences (onboarding)
 * - Learned preferences (from session history)
 * - Beach affinity (familiarity scores)
 */

/**
 * Preferred wave size from onboarding.
 */
export type WaveSizePreference = 'small' | 'medium' | 'large' | 'any';

/**
 * Maps wave size preference to approximate height range (feet).
 */
export const WAVE_SIZE_RANGES: Record<
  WaveSizePreference,
  { minFt: number; maxFt: number }
> = {
  small: { minFt: 1, maxFt: 3 },
  medium: { minFt: 3, maxFt: 6 },
  large: { minFt: 6, maxFt: 15 },
  any: { minFt: 0, maxFt: 20 },
};

/**
 * Crowd preference from onboarding.
 */
export type CrowdPreference = 'empty' | 'some' | 'any';

/**
 * Preferences set during user onboarding.
 * These are explicit user choices.
 */
export interface OnboardingPreferences {
  /** Preferred wave size category */
  readonly waveSize: WaveSizePreference | null;
  /** Preferred break type (beach, point, reef, etc.) */
  readonly breakType: string | null;
  /** Crowd tolerance */
  readonly crowdPreference: CrowdPreference | null;
}

/**
 * Preferences learned from session history.
 * Computed from analysis of sessions with rating >= 3.
 * All values null if insufficient data (< 5 rated sessions).
 */
export interface LearnedPreferences {
  /** Wave height range from good sessions (10th-90th percentile) */
  readonly waveRange: {
    readonly minFt: number;
    readonly maxFt: number;
  } | null;

  /** Wave period range from good sessions */
  readonly periodRange: {
    readonly minS: number;
    readonly maxS: number;
  } | null;

  /** Maximum wind speed tolerated in good sessions */
  readonly maxWindMph: number | null;

  /** Preferred wind directions (degrees, 0-360) */
  readonly preferredWindDirections: readonly number[] | null;

  /** Preferred tide statuses */
  readonly preferredTideStatuses: readonly string[] | null;

  /**
   * Confidence in learned preferences (0-1).
   * Based on sample size: 5 sessions = 0.5, 10 = 0.73, 20+ = 0.95+
   */
  readonly confidence: number;

  /** Number of rated sessions used for learning */
  readonly sampleSize: number;
}

/**
 * Beach-specific affinity from session history.
 * Higher affinity = more familiar with the spot.
 */
export interface BeachAffinity {
  /** Beach ID */
  readonly beachId: string;
  /** Affinity score (0-100) */
  readonly affinityScore: number;
  /** Number of sessions at this beach */
  readonly sessionCount: number;
  /** Most recent session */
  readonly lastSurfedAt: Date | null;
}

/**
 * Complete user preferences aggregate.
 * Combines explicit, learned, and behavioral preferences.
 */
export interface UserPreferences {
  /** User ID */
  readonly userId: string;

  /** Explicit onboarding preferences */
  readonly onboarding: OnboardingPreferences;

  /** Learned preferences from session history (null if insufficient data) */
  readonly learned: LearnedPreferences | null;

  /** Beach affinity map (beachId -> affinity) */
  readonly affinityMap: ReadonlyMap<string, BeachAffinity>;

  /** Home beach ID (if set) */
  readonly homeBeachId: string | null;

  /** Favorite beach IDs (ordered by rank) */
  readonly favoriteBeachIds: readonly string[];
}

/**
 * Result of matching user preferences against conditions.
 */
export interface PreferenceMatch {
  /** Does condition match onboarding wave size preference */
  readonly matchesOnboardingWaveSize: boolean;

  /** Does condition match onboarding break type preference */
  readonly matchesOnboardingBreakType: boolean;

  /** Does condition match learned wave range */
  readonly matchesLearnedWaveRange: boolean;

  /** Does condition match learned wind preferences */
  readonly matchesLearnedWind: boolean;

  /** Does condition match learned tide preferences */
  readonly matchesLearnedTide: boolean;

  /** Bonus points from beach affinity (0-15) */
  readonly affinityBonus: number;

  /** Total bonus points from all preference matches */
  readonly totalBonus: number;

  /** Reasons for the match (positive factors) */
  readonly reasons: readonly string[];
}

/**
 * Default values for user preferences.
 */
export const USER_PREFERENCES_DEFAULTS = {
  onboarding: {
    waveSize: null,
    breakType: null,
    crowdPreference: null,
  } as OnboardingPreferences,

  learned: null,

  /** Maximum affinity bonus points */
  maxAffinityBonus: 15,

  /** Minimum confidence threshold to apply learned preferences */
  minConfidenceThreshold: 0.5,
} as const;

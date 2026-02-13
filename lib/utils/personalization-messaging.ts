/**
 * Personalization Messaging Utilities
 *
 * Central copy generator that all personalization touchpoints share.
 * Pure functions, no side effects.
 *
 * @module lib/utils/personalization-messaging
 */

import {
  type MilestoneKey,
  PERSONALIZATION_MILESTONES,
} from "@/lib/constants/personalization-milestones";

// =============================================================================
// Types
// =============================================================================

/**
 * Score breakdown shape used by PersonalizedBadge and recommendation scorer.
 * Mirrors the `breakdown` prop from `PersonalizedBadgeProps`.
 */
export interface PersonalizationBreakdown {
  base: number;
  onboardingPrefs: number;
  learnedPrefs: number;
  affinity: number;
}

/**
 * Personalization status stages for progress card content.
 */
export type PersonalizationStage =
  | "getting_started"
  | "learning"
  | "personalized";

/**
 * Content returned by `getPersonalizationProgress()`.
 */
export interface ProgressCardContent {
  title: string;
  description: string;
  stage: PersonalizationStage;
}

/**
 * Content returned by `getMilestoneCopy()`.
 */
export interface MilestoneCopyContent {
  title: string;
  description: string;
}

/**
 * Metadata bag for milestone copy interpolation.
 * Only supply the keys relevant to the milestone being rendered.
 */
export interface MilestoneMetadata {
  min?: number;
  max?: number;
  timeSlot?: string;
  beach?: string;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Returns a one-liner explanation based on the dominant personalization factor.
 *
 * Priority order: learned > onboarding > affinity > fallback.
 *
 * @param breakdown - Score component breakdown
 * @returns Human-readable explanation string
 *
 * @example
 * ```ts
 * getPersonalizationExplanation({ base: 60, onboardingPrefs: 5, learnedPrefs: 12, affinity: 3 })
 * // "Tuned to your session history"
 * ```
 */
export function getPersonalizationExplanation(
  breakdown: PersonalizationBreakdown
): string {
  const { onboardingPrefs, learnedPrefs, affinity } = breakdown;

  // Determine dominant non-base factor
  const max = Math.max(learnedPrefs, onboardingPrefs, affinity);

  if (max <= 0) {
    return "Personalized for you";
  }

  if (learnedPrefs >= onboardingPrefs && learnedPrefs >= affinity) {
    return "Tuned to your session history";
  }

  if (onboardingPrefs >= affinity) {
    return "Matched to your wave and break preferences";
  }

  return "One of your go-to spots";
}

/**
 * Returns a more specific source label for the dominant personalization factor.
 *
 * Produces contextual labels like "Matches your 2-4ft preference" or
 * "Based on 8 past sessions here". Falls back to a generic label when
 * the breakdown has no dominant non-base factor.
 *
 * @param breakdown - Score component breakdown
 * @param beachName - Optional beach name for affinity labels
 * @returns Human-readable source label
 *
 * @example
 * ```ts
 * getPersonalizationSourceLabel(
 *   { base: 60, onboardingPrefs: 10, learnedPrefs: 2, affinity: 0 },
 *   "Blacks"
 * )
 * // "Matched to your wave and break preferences"
 * ```
 */
export function getPersonalizationSourceLabel(
  breakdown: PersonalizationBreakdown,
  beachName?: string
): string {
  const { onboardingPrefs, learnedPrefs, affinity } = breakdown;

  const max = Math.max(learnedPrefs, onboardingPrefs, affinity);

  if (max <= 0) {
    return "Personalized for you";
  }

  if (learnedPrefs >= onboardingPrefs && learnedPrefs >= affinity) {
    return "Similar to sessions you rated highly";
  }

  if (onboardingPrefs >= affinity) {
    return "Matched to your wave and break preferences";
  }

  if (beachName) {
    return `One of your go-to spots at ${beachName}`;
  }

  return "One of your go-to spots";
}

/**
 * Returns progress card content based on the user's personalization status.
 *
 * @param status - Current personalization status stage
 * @returns Title, description, and stage for the progress card
 *
 * @example
 * ```ts
 * getPersonalizationProgress("learning")
 * // { title: "Learning Your Style", description: "...", stage: "learning" }
 * ```
 */
export function getPersonalizationProgress(
  status: PersonalizationStage
): ProgressCardContent {
  switch (status) {
    case "getting_started":
      return {
        title: "Getting Started",
        description:
          "Log your first session to activate personalized recommendations.",
        stage: "getting_started",
      };
    case "learning":
      return {
        title: "Learning Your Style",
        description:
          "Keep logging sessions and checking forecasts. Your recommendations get better with every interaction.",
        stage: "learning",
      };
    case "personalized":
      return {
        title: "Fully Personalized",
        description:
          "Your forecasts and recommendations are tuned to your preferences, history, and favorite spots.",
        stage: "personalized",
      };
  }
}

/**
 * Returns milestone notification content with interpolated metadata.
 *
 * Replaces `{placeholder}` tokens in the milestone description template
 * with values from the metadata object.
 *
 * @param key - Milestone identifier
 * @param metadata - Optional values to interpolate into the description
 * @returns Title and interpolated description
 *
 * @example
 * ```ts
 * getMilestoneCopy("wave_range_learned", { min: 2, max: 4 })
 * // { title: "Wave Sweet Spot Learned", description: "We've learned your wave sweet spot: 2-4ft." }
 *
 * getMilestoneCopy("time_slot_detected", { timeSlot: "dawn patrol" })
 * // { title: "Session Timing Detected", description: "Looks like you're a dawn patrol surfer." }
 * ```
 */
export function getMilestoneCopy(
  key: MilestoneKey,
  metadata?: MilestoneMetadata
): MilestoneCopyContent {
  const milestone = PERSONALIZATION_MILESTONES[key];
  let description = milestone.description;

  if (metadata) {
    if (metadata.min !== undefined) {
      description = description.replace("{min}", String(metadata.min));
    }
    if (metadata.max !== undefined) {
      description = description.replace("{max}", String(metadata.max));
    }
    if (metadata.timeSlot !== undefined) {
      description = description.replace("{timeSlot}", metadata.timeSlot);
    }
    if (metadata.beach !== undefined) {
      description = description.replace("{beach}", metadata.beach);
    }
  }

  return {
    title: milestone.title,
    description,
  };
}

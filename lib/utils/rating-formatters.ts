/**
 * Rating formatting utilities for consistent rating display across the app
 */

export interface RatingFormatOptions {
  /** Fallback text when rating is null/undefined (default: "--") */
  fallback?: string;
  /** Maximum rating value for display (e.g., 5 for "4.5/5") */
  maxValue?: number;
  /** Number of decimal places (default: 1) */
  decimals?: number;
}

/**
 * Format a rating number for display with consistent fallback and precision
 *
 * @param rating - Rating value (number, null, or undefined)
 * @param options - Formatting options
 * @returns Formatted rating string
 *
 * @example
 * formatRating(4.567)
 * // Returns: "4.6"
 *
 * @example
 * formatRating(4.5, { maxValue: 5 })
 * // Returns: "4.5/5"
 *
 * @example
 * formatRating(null, { fallback: "N/A" })
 * // Returns: "N/A"
 *
 * @example
 * formatRating(4.567, { decimals: 2 })
 * // Returns: "4.57"
 */
export function formatRating(
  rating: number | null | undefined,
  options: RatingFormatOptions = {}
): string {
  const {
    fallback = "--",
    maxValue,
    decimals = 1,
  } = options;

  // Check if rating is a valid finite number
  if (!rating || !Number.isFinite(rating)) {
    return fallback;
  }

  // Format the rating with specified decimal places
  const formatted = rating.toFixed(decimals);

  // Add max value suffix if provided
  return maxValue ? `${formatted}/${maxValue}` : formatted;
}

/**
 * Format rating with "/5" suffix
 * Convenience wrapper for the common "X.X/5" pattern
 *
 * @param rating - Rating value
 * @param fallback - Fallback text (default: "N/A")
 * @returns Formatted rating with "/5" suffix
 *
 * @example
 * formatRatingOutOf5(4.5)
 * // Returns: "4.5/5"
 */
export function formatRatingOutOf5(
  rating: number | null | undefined,
  fallback: string = "N/A"
): string {
  return formatRating(rating, { maxValue: 5, fallback });
}

/**
 * Format rating as simple decimal (no suffix)
 * Convenience wrapper for simple decimal formatting
 *
 * @param rating - Rating value
 * @param fallback - Fallback text (default: "--")
 * @returns Formatted rating as decimal
 *
 * @example
 * formatRatingSimple(4.567)
 * // Returns: "4.6"
 */
export function formatRatingSimple(
  rating: number | null | undefined,
  fallback: string = "--"
): string {
  return formatRating(rating, { fallback });
}

/**
 * Format a surf discovery score from 0-100 scale to X.X display format.
 * Specifically for SurfDiscoveryRecommendation scores.
 *
 * - Caps at 9.9 (perfect conditions are theoretical)
 * - Whole numbers display without decimal (e.g., "8" not "8.0")
 * - Non-whole numbers show one decimal (e.g., "8.5")
 *
 * @param score - The score value (0-100)
 * @returns Formatted string like "8.5" or "8" (without the "/10" suffix)
 *
 * @example
 * formatDiscoveryScore(85)
 * // Returns: "8.5"
 *
 * @example
 * formatDiscoveryScore(100)
 * // Returns: "9.9"
 *
 * @example
 * formatDiscoveryScore(80)
 * // Returns: "8"
 */
export function formatDiscoveryScore(score: number): string {
  // Cap at 99 (which becomes 9.9)
  const cappedScore = Math.min(score, 99);
  const displayValue = cappedScore / 10;

  // Check if it's a whole number (no decimal needed)
  if (displayValue % 1 === 0) {
    return displayValue.toString();
  }

  return displayValue.toFixed(1);
}

/**
 * Format a surf discovery score with "/10" suffix.
 *
 * @param score - The score value (0-100)
 * @returns Formatted string like "8.5/10"
 *
 * @example
 * formatDiscoveryScoreWithSuffix(85)
 * // Returns: "8.5/10"
 */
export function formatDiscoveryScoreWithSuffix(score: number): string {
  return `${formatDiscoveryScore(score)}/10`;
}

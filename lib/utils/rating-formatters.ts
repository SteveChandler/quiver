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

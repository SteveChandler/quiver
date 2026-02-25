/**
 * Amenity Fallback Utilities
 *
 * Derives a partial BeachAmenities object from the unstructured `features` and
 * `amenities` string arrays that already exist on non-CA Beach records. This is
 * a simple keyword-matching utility, not NLP. It is used as a client-side
 * fallback when no CCC-sourced `mv_beach_amenities` row exists for a beach.
 *
 * @module lib/utils/amenity-fallback-utils
 */

import type { BeachAmenities } from "@/types/amenities";

/**
 * Keyword patterns that map to specific amenity flags.
 * Each entry is a tuple of [amenityKey, regexPatterns].
 * A flag is set to true if any of the patterns match any string in the input arrays.
 */
const KEYWORD_PATTERNS: Array<[keyof Omit<BeachAmenities, "beach_id" | "source_count" | "nearest_source_m">, RegExp]> = [
  ["has_parking", /\bpark(ing)?\b/i],
  ["has_fee", /\b(fee|paid|permit|cost|charge)\b/i],
  ["has_restrooms", /\b(restroom|bathroom|toilet|wc)\b/i],
  ["has_ada_access", /\b(ada|accessible|wheelchair|handicap)\b/i],
  ["has_dog_friendly", /\b(dog|pet|leash)\b/i],
  ["has_stroller_friendly", /\b(stroller|pram|buggy)\b/i],
  ["has_campground", /\b(camp(ing|ground|site)?|rv)\b/i],
  ["has_visitor_center", /\b(visitor.?center|ranger.?station|info.?center)\b/i],
  ["has_boating", /\b(boat(ing|launch)?|marina|kayak|canoe)\b/i],
  ["has_fishing", /\b(fish(ing)?|pier)\b/i],
  ["has_picnic_area", /\b(picnic|bbq|barbecue|grill)\b/i],
  ["has_volleyball", /\b(volleyball|sand.?court)\b/i],
  ["has_bike_path", /\b(bike|bicycle|cycling|path|trail)\b/i],
  ["has_tidepools", /\b(tidepool|tide.?pool|intertidal)\b/i],
  ["has_sandy_beach", /\b(sandy|sand.?beach)\b/i],
  ["has_rocky_shore", /\b(rock(y|s)?|cobble|stone)\b/i],
  ["has_bluff_trail", /\b(bluff|cliff|overlook|vista)\b/i],
  ["has_wildlife_viewing", /\b(wildlife|bird|seal|whale|dolphin|nature)\b/i],
];

/**
 * Derives a partial BeachAmenities object by keyword-matching against a beach's
 * unstructured `features` and `amenities` string arrays.
 *
 * Returns null if both input arrays are null/empty, so callers can skip rendering.
 *
 * @example
 * const result = deriveAmenitiesFromFeatures(
 *   ["Parking available", "Dog friendly"],
 *   ["Restrooms", "Picnic tables"]
 * );
 * // result?.has_parking === true
 * // result?.has_dog_friendly === true
 * // result?.has_restrooms === true
 */
export function deriveAmenitiesFromFeatures(
  features: string[] | null,
  amenities: string[] | null
): Partial<BeachAmenities> | null {
  const combined = [...(features ?? []), ...(amenities ?? [])];
  if (combined.length === 0) return null;

  const result: Partial<BeachAmenities> = {};
  let anyMatch = false;

  for (const [key, pattern] of KEYWORD_PATTERNS) {
    const matched = combined.some((str) => pattern.test(str));
    if (matched) {
      (result as Record<string, boolean>)[key] = true;
      anyMatch = true;
    }
  }

  return anyMatch ? result : null;
}

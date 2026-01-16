// lib/seo/city-slug-utils.ts
/**
 * City slug utilities for database-driven intent pages.
 * Handles slug generation, collision detection, and resolution.
 */

import { slugifyAscii } from "@/lib/utils/text-utils";

/**
 * US state abbreviations mapped to slugs.
 */
export const US_STATE_SLUGS: Record<string, string> = {
  AL: "al", AK: "ak", AZ: "az", AR: "ar", CA: "ca",
  CO: "co", CT: "ct", DE: "de", FL: "fl", GA: "ga",
  HI: "hi", ID: "id", IL: "il", IN: "in", IA: "ia",
  KS: "ks", KY: "ky", LA: "la", ME: "me", MD: "md",
  MA: "ma", MI: "mi", MN: "mn", MS: "ms", MO: "mo",
  MT: "mt", NE: "ne", NV: "nv", NH: "nh", NJ: "nj",
  NM: "nm", NY: "ny", NC: "nc", ND: "nd", OH: "oh",
  OK: "ok", OR: "or", PA: "pa", RI: "ri", SC: "sc",
  SD: "sd", TN: "tn", TX: "tx", UT: "ut", VT: "vt",
  VA: "va", WA: "wa", WV: "wv", WI: "wi", WY: "wy",
  PR: "pr", // Puerto Rico
};

/**
 * Reverse mapping: slug to state abbreviation.
 */
export const SLUG_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_SLUGS).map(([abbrev, slug]) => [slug, abbrev])
);

/**
 * All valid state slugs as a Set for O(1) lookup.
 */
export const VALID_STATE_SLUGS = new Set(Object.values(US_STATE_SLUGS));

export interface CityStateRecord {
  city: string;
  state: string;
}

/**
 * Detect city names that appear in multiple states.
 * Returns a Map of slugified city name -> count of states.
 * Only includes entries where count > 1 (actual collisions).
 */
export function detectCityCollisions(
  cities: CityStateRecord[]
): Map<string, number> {
  const cityStateCounts = new Map<string, Set<string>>();

  for (const { city, state } of cities) {
    const slug = slugifyAscii(city);
    if (!slug) continue;

    const states = cityStateCounts.get(slug) || new Set();
    states.add(state.toUpperCase());
    cityStateCounts.set(slug, states);
  }

  // Filter to only collisions (appears in 2+ states)
  const collisions = new Map<string, number>();
  for (const [slug, states] of cityStateCounts) {
    if (states.size > 1) {
      collisions.set(slug, states.size);
    }
  }

  return collisions;
}

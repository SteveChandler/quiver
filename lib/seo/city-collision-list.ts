/**
 * Static set of city slugs that collide across multiple states
 * or are substrings of other city slugs.
 *
 * These cities need a state suffix in intent URLs to avoid ambiguity.
 * For example: /sunset/long-beach-ca vs /sunset/long-beach-ny
 *
 * Generated from production beach data using detectCityCollisions().
 * Re-generate with: npx tsx scripts/generate-collision-list.ts
 *
 * Last updated: 2026-02-10
 */
/**
 * Static collision map matching the output of detectCityCollisions().
 * Maps slugified city name → number of states (or 2 for substring collisions).
 *
 * Used by sitemap, intent pages, and redirect handlers to build correct
 * canonical URLs without a runtime database query.
 */
export const COLLISION_CITY_MAP = new Map<string, number>([
  ["koloa", 2],       // HI - substring collision (matches waikoloa)
  ["long-beach", 3],  // CA, NY, WA
  ["newport", 2],     // OR - substring of newport-beach, newport-coast
]);

/**
 * Set of city slugs that collide — derived from COLLISION_CITY_MAP.
 * Use for O(1) has() checks. Use the Map when count values are needed.
 */
export const COLLISION_CITY_SLUGS = new Set(COLLISION_CITY_MAP.keys());

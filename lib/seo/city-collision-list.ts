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
 * Last updated: 2026-02-08
 */
export const COLLISION_CITY_SLUGS = new Set([
  "koloa",       // HI - substring collision in ILIKE lookup (matches waikoloa)
  "long-beach",  // CA, NY, WA
  "newport",     // OR - substring of newport-beach, newport-coast
]);

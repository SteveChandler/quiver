/**
 * Regional Guide Copy
 *
 * Hand-written one-line subtitles for each regional surf guide cross-link
 * shown on the /forecast hub. Replaces the repeated boilerplate
 * "Explore surf spots, local knowledge, and conditions" line that appeared
 * on every card.
 *
 * Keys are **guide slugs** (the value returned by `getGuideSlugForRegion`),
 * not forecast-region slugs — some regions share a guide (e.g. LA maps to
 * `southern-california`).
 *
 * Each line is a piece of local knowledge: when the region works, what
 * it's known for, or a micro-pattern a surfer would actually want to know.
 * Keep them short (under ~90 chars) and specific.
 *
 * @module lib/data/regional-guide-copy
 */

export const REGIONAL_GUIDE_COPY: Record<string, string> = {
  // California
  "southern-california":
    "Dawn patrol points, summer south swells, and the grind of Lowers on a Tuesday.",
  "san-diego":
    "Reefs from Blacks to Big Rock. Fires on WNW groundswell; crowded when it's small.",
  "orange-county":
    "HB pier, Newport wedge, Trestles. Peaks year-round, offshore in the morning.",
  "northern-california":
    "Cold water, big power. Mavericks looms; Ocean Beach eats boards and beginners.",
  "santa-cruz":
    "Steamer Lane when a NW fills in. Pleasure Point for glass, Davenport for size.",
  ventura:
    "Rincon lights up on a winter W. Jalama for the brave, C-Street for the rest.",

  // Pacific
  hawaii:
    "North Shore November through February. Summer south swells wrap to Waikiki's walls.",
  oregon:
    "Heavy, cold, and uncrowded. Indian Beach for intermediates, Short Sands for the rest.",
  washington:
    "Westport is the only real year-round option. Bring a 5mm and no expectations.",

  // East Coast
  florida:
    "Hurricane season is Christmas. Sebastian and New Smyrna when the Atlantic wakes up.",
  "outer-banks":
    "Nor'easters turn the cape into barrels. S-turns sandbars shift every storm.",
  "new-york":
    "Rockaway after a storm, Montauk for points. Cold, fickle, crowded when it's on.",
  "new-jersey":
    "Manasquan to Cape May. Beach-break barrels when a NE hits and the banks line up.",

  // Caribbean
  "puerto-rico":
    "Rincon is the winter groundswell magnet. Aguadilla, Domes, Tres Palmas on a NW pulse.",

  // Mexico
  "baja-california":
    "Rosarito and Km 38 a short drive south. Bigger and less crowded than San Diego.",
};

/**
 * Get the hand-written subtitle for a guide slug. Falls back to a generic
 * line if the slug isn't mapped (future-proof against new regions shipping
 * before copy lands).
 */
export function getRegionalGuideSubtitle(guideSlug: string): string {
  return (
    REGIONAL_GUIDE_COPY[guideSlug] ??
    "Local spots, when they work, and who surfs them."
  );
}

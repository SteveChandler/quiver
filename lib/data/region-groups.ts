/**
 * Region Groups
 *
 * Groups forecast region slugs into display categories (California, Pacific, etc.)
 * Used by the landing page navbar and forecast hub page for organized region display.
 *
 * @module lib/data/region-groups
 */

export interface RegionGroup {
  label: string;
  slugs: string[];
}

export const REGION_GROUPS: RegionGroup[] = [
  {
    label: "California",
    slugs: [
      "southern-california",
      "san-diego",
      "orange-county",
      "los-angeles",
      "northern-california",
      "santa-cruz",
      "ventura-santa-barbara",
    ],
  },
  { label: "Pacific", slugs: ["hawaii", "oregon", "washington"] },
  {
    label: "East Coast",
    slugs: ["florida", "outer-banks", "new-york", "new-jersey"],
  },
  { label: "International", slugs: ["puerto-rico", "baja-california"] },
];

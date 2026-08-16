/**
 * State-root routing helpers.
 *
 * Goal: support `/[state]` landing pages without colliding with
 * reserved one-segment routes like `/map`, `/about`, etc.
 */

export const RESERVED_ONE_SEGMENT_SLUGS = new Set([
  "map",
  "about",
  "features",
  "download",
  "login",
  "signup",
  "plans",
  "pricing",
  "privacy",
  "terms",
  "contact",
  "blog",
  "api",
  "_next",
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
]);

export function normalizeStateSlug(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

function toDbState(state: string): string {
  return normalizeStateSlug(state).toUpperCase();
}

const US_STATE_NAMES_BY_CODE: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  PR: "Puerto Rico",
};

/**
 * DB state candidates for a given two-letter state slug.
 *
 * We support both code and full-name storage in `beaches.state`:
 * - "CA" and/or "California"
 */
export function getDbStateCandidatesForStateSlug(stateSlug: string): string[] {
  const code = toDbState(stateSlug);
  const name = US_STATE_NAMES_BY_CODE[code];
  return [code, name].filter(Boolean) as string[];
}

/**
 * Friendly display name for a 2-letter state slug.
 *
 * Examples:
 * - "ca" -> "California"
 * - "sc" -> "South Carolina"
 * - "pr" -> "Puerto Rico"
 *
 * Falls back to the uppercased code when unknown.
 */
export function getStateDisplayNameFromSlug(stateSlug: string): string {
  const code = toDbState(stateSlug);
  return US_STATE_NAMES_BY_CODE[code] || code;
}













import { slugifyAscii } from "@/lib/utils/text-utils";

/** US states, DC and the territories NOAA CO-OPS reports in `state`. */
const US_REGION_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AS: "American Samoa",
  CA: "California",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  GU: "Guam",
  HI: "Hawaii",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MP: "Northern Mariana Islands",
  MS: "Mississippi",
  NC: "North Carolina",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NY: "New York",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  TX: "Texas",
  UM: "U.S. Minor Outlying Islands",
  VA: "Virginia",
  VI: "U.S. Virgin Islands",
  WA: "Washington",
};

/** Territories that tz data files under their own country code but that Quiver lists under the US. */
export const US_TERRITORY_COUNTRY_CODES: ReadonlySet<string> = new Set(["AS", "GU", "MP", "PR", "UM", "VI"]);

/** Path segments under /tides that a country slug must never take. */
const RESERVED_TIDE_SEGMENTS: ReadonlySet<string> = new Set(["station", "sitemap-xml"]);

export const US_COUNTRY_SLUG = "usa";

export function isUsRegionCode(code: string | null | undefined): boolean {
  return Boolean(code && Object.hasOwn(US_REGION_NAMES, code.toUpperCase()));
}

export function usRegionName(code: string): string {
  return US_REGION_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export function countryName(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code === "US") return "United States";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function countrySlug(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code === "US") return US_COUNTRY_SLUG;
  const slug = slugifyAscii(countryName(code)) || code.toLowerCase();
  return RESERVED_TIDE_SEGMENTS.has(slug) ? `${slug}-${code.toLowerCase()}` : slug;
}

export function regionSlug(regionCode: string): string {
  return regionCode.toLowerCase();
}

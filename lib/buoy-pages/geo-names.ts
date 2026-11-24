/**
 * Country and region names and URL slugs for the buoy hubs. Countries come
 * from ISO codes on the catalogue rows, so new countries need no code change.
 */

const US_REGION_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia", PR: "Puerto Rico",
  VI: "US Virgin Islands", GU: "Guam", AS: "American Samoa", MP: "Northern Mariana Islands",
  UM: "US Minor Outlying Islands",
};

let regionDisplayNames: Intl.DisplayNames | null = null;

export function countryName(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code === "US") return "United States";
  try {
    regionDisplayNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionDisplayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Region names are known for US states and territories; other codes show as-is. */
export function regionName(countryCode: string, regionCode: string): string {
  if (countryCode.toUpperCase() === "US") {
    return US_REGION_NAMES[regionCode.toUpperCase()] ?? regionCode.toUpperCase();
  }
  return regionCode.toUpperCase();
}

const CODE_SLUG = /^[a-z]{2}$/;

/** Hub slugs are lowercase two-letter codes: /buoys/us, /buoys/us/ca. */
export function isCodeSlug(value: string): boolean {
  return CODE_SLUG.test(value);
}

export function countryPath(countryCode: string): string {
  return `/buoys/${countryCode.toLowerCase()}`;
}

export function regionPath(countryCode: string, regionCode: string): string {
  return `/buoys/${countryCode.toLowerCase()}/${regionCode.toLowerCase()}`;
}

export function stationPath(slug: string): string {
  return `/buoys/station/${slug}`;
}

/** "California, United States", "Canada", or null for a station with no country. */
export function placeLabel(
  station: { country_code: string | null; region: string | null },
): string | null {
  if (!station.country_code) return null;
  const country = countryName(station.country_code);
  if (!station.region) return country;
  return `${regionName(station.country_code, station.region)}, ${country}`;
}

/**
 * Build canonical short URLs for location pages.
 *
 * The middleware serves these via internal rewrite (no visible redirect):
 *   USA:  /{state}/{city}               e.g. /ca/la-jolla
 *   Intl: /{country}/{state}/{city}     e.g. /mexico/baja-california/ensenada
 */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildCanonicalLocationUrl(
  city: string,
  state: string,
  country: string = "USA"
): string {
  const stateSlug = slugify(state);
  const citySlug = slugify(city);

  if (!citySlug || !stateSlug) {
    return "/map";
  }

  const countryNorm = country.toLowerCase();
  if (countryNorm === "usa" || countryNorm === "us") {
    // USA canonical: /{state}/{city}
    return `/${stateSlug}/${citySlug}`;
  }

  // International canonical: /{country}/{state}/{city}
  const countrySlug = slugify(country);
  return `/${countrySlug}/${stateSlug}/${citySlug}`;
}

export type LocationPlaceBeachItem = {
  name: string;
  url: string;
};

export type BuildLocationPlaceStructuredDataInput = {
  city: string;
  state: string;
  topBeaches: LocationPlaceBeachItem[];
};

/**
 * Build Location (city) JSON-LD structured data.
 *
 * NOTE: We intentionally do NOT emit AggregateRating/Review markup here because
 * Google review snippets do not support ratings on Place/Beach types, and
 * emitting it can trigger Search Console "Review snippets" errors.
 */
export function buildLocationPlaceStructuredData({
  city,
  state,
  topBeaches,
}: BuildLocationPlaceStructuredDataInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${city}, ${state}`,
    description: `Surf beaches in ${city}, ${state}`,
    containsPlace: topBeaches.map((beach) => ({
      "@type": "Beach",
      name: beach.name,
      url: beach.url,
    })),
  };
}


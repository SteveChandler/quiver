import { AMENITY_DISPLAY_MAP } from "@/types/amenities";
import type { AmenityKey } from "@/types/amenities";

/** Subset of BeachAmenities boolean flags accepted by BeachPageStructuredData */
type BeachAmenitiesInput = Partial<Record<AmenityKey, boolean | null>>;

export function BeachPageStructuredData({
  beachName,
  description,
  latitude,
  longitude,
  city,
  state,
  country,
  amenities,
}: {
  beachName: string;
  description: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  amenities?: BeachAmenitiesInput | null;
}) {
  // Keep beach markup as Place; SportsActivityLocation is a LocalBusiness type
  // and incorrectly makes public beaches eligible for business rich results.
  const amenityFeatures = amenities
    ? (Object.keys(AMENITY_DISPLAY_MAP) as AmenityKey[])
        .filter((key) => amenities[key])
        .map((key) => ({
          "@type": "LocationFeatureSpecification" as const,
          name: AMENITY_DISPLAY_MAP[key].label,
          value: true,
        }))
    : [];

  const geo = {
    "@type": "GeoCoordinates",
    latitude: latitude,
    longitude: longitude,
  };

  const placeData = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: beachName,
    description: description,
    geo,
    address: {
      "@type": "PostalAddress",
      addressLocality: city || undefined,
      addressRegion: state || undefined,
      addressCountry: country || "US",
    },
    ...(amenityFeatures.length > 0 ? { amenityFeature: amenityFeatures } : {}),
  };

  // Organization is already in the root layout via buildRootStructuredDataGraph()
  // in app/layout.tsx.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(placeData),
      }}
    />
  );
}

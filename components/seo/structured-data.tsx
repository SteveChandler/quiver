"use client";

import { SEO_CONFIG } from "@/lib/constants/seo";
import { AMENITY_DISPLAY_MAP } from "@/types/amenities";
import type { AmenityKey } from "@/types/amenities";

interface StructuredDataProps {
  type?: "organization" | "softwareApplication" | "website" | "all";
  customData?: Record<string, any>;
}

export function StructuredData({
  type = "all",
  customData,
}: StructuredDataProps) {
  const getStructuredData = () => {
    const { structuredData } = SEO_CONFIG;

    if (type === "all") {
      return [
        structuredData.organization,
        structuredData.softwareApplication,
        structuredData.website,
        ...(customData ? [customData] : []),
      ];
    }

    return [structuredData[type], ...(customData ? [customData] : [])];
  };

  const data = getStructuredData();

  return (
    <>
      {data.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema),
          }}
        />
      ))}
    </>
  );
}

// Specific structured data for different page types
export function HomePageStructuredData() {
  const siteUrl = SEO_CONFIG.structuredData.website.url;

  const homePageData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Quiver — Surf Reports, Forecasts & Conditions",
    description:
      "ML-powered surf forecasts, crowd intelligence, and personalized surf windows for 185+ beaches. Updated every 3 hours with live buoy data.",
    url: siteUrl,
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Quiver Surf App",
      applicationCategory: "Sports & Recreation",
      operatingSystem: ["Web", "iOS", "Android"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteUrl,
        },
      ],
    },
  };

  return <StructuredData type="all" customData={homePageData} />;
}

/** Subset of BeachAmenities boolean flags accepted by BeachPageStructuredData */
type BeachAmenitiesInput = Partial<Record<AmenityKey, boolean | null>>;

export function BeachPageStructuredData({
  beachName,
  description,
  latitude,
  longitude,
  rating: _rating,
  reviewCount: _reviewCount,
  city,
  state,
  country,
  amenities,
}: {
  beachName: string;
  description: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewCount?: number;
  city?: string;
  state?: string;
  country?: string;
  amenities?: BeachAmenitiesInput | null;
}) {
  // Always include the base "Surfing" feature, then append any true amenity flags.
  const amenityFeatures: Array<{
    "@type": "LocationFeatureSpecification";
    name: string;
    value: boolean;
  }> = [
    { "@type": "LocationFeatureSpecification", name: "Surfing", value: true },
  ];

  if (amenities) {
    for (const key of Object.keys(AMENITY_DISPLAY_MAP) as AmenityKey[]) {
      if (amenities[key]) {
        amenityFeatures.push({
          "@type": "LocationFeatureSpecification",
          name: AMENITY_DISPLAY_MAP[key].label,
          value: true,
        });
      }
    }
  }

  const beachData = {
    "@context": "https://schema.org",
    "@type": ["Place", "SportsActivityLocation"],
    name: beachName,
    description: description,
    sport: "Surfing",
    geo: {
      "@type": "GeoCoordinates",
      latitude: latitude,
      longitude: longitude,
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: city || undefined,
      addressRegion: state || undefined,
      addressCountry: country || "US",
    },
    // Do NOT emit AggregateRating here. Google review snippets require eligible
    // types (LocalBusiness, Product, etc.) — Place is not eligible. Even if we
    // used SportsActivityLocation (a LocalBusiness subtype), Google's self-serving
    // review policy blocks snippets when the site controls its own reviews.
    // Emitting it only triggers Search Console "Review snippets" errors.
    // See: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
    amenityFeature: amenityFeatures,
  };

  return <StructuredData type="organization" customData={beachData} />;
}

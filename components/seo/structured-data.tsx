"use client";

import { SEO_CONFIG } from "@/lib/constants/seo";

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
    name: "Quiver - Ultimate Surf Community Platform",
    description:
      "Find surf buddies, track sessions, get forecasts. Join the ultimate surf community.",
    url: siteUrl,
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Quiver Surf Community App",
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
}) {
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
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Surfing",
        value: true,
      },
    ],
  };

  return <StructuredData type="organization" customData={beachData} />;
}

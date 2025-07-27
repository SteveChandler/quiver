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
  const homePageData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Quiver - Ultimate Surf Community Platform",
    description:
      "Find surf buddies, track sessions, get forecasts. Join the ultimate surf community.",
    url: "https://quiver.surf",
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
          item: "https://quiver.surf",
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
  rating,
  reviewCount,
}: {
  beachName: string;
  description: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewCount?: number;
}) {
  const beachData = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: beachName,
    description: description,
    geo: {
      "@type": "GeoCoordinates",
      latitude: latitude,
      longitude: longitude,
    },
    ...(rating &&
      reviewCount && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: rating,
          reviewCount: reviewCount,
          bestRating: 5,
          worstRating: 1,
        },
      }),
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

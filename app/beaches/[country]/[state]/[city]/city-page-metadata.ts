/**
 * Metadata generation for the city/location listing page.
 *
 * Re-exported from page.tsx as a Next.js named export.
 */

import {
  getLocationPageData,
} from "@/actions/beach/beach-location-list-actions";
import {
  isValidStateSlug,
  isValidCountrySlug,
} from "@/lib/utils/beach-url-utils";
import {
  SITE_ORIGIN,
  resolveDisplayCityName,
  resolveMetroConfig,
} from "./city-page-utils";
import type { LocationPageProps } from "./city-page-utils";
import { expandStateForMeta, truncateTitleForSEO } from "@/lib/seo/meta";

export async function generateMetadata(props: LocationPageProps) {
  const params = await props.params;
  // Validate country parameter - return not found metadata for invalid countries
  if (!isValidCountrySlug(params.country)) {
    return {
      title: "Location Not Found",
    };
  }

  try {
    const metroConfig = resolveMetroConfig(params.city);

    const response = await getLocationPageData(
      params.city,
      params.state,
      params.country
    );

    if (!response.success || !response.data) {
      return {
        title: "Location Not Found",
      };
    }

    const { location, stats } = response.data;

    const displayCityName = resolveDisplayCityName(
      location.city,
      params.state,
      params.city
    );

    const expandedState = expandStateForMeta(location.state || params.state);

    // Build improved title with beach names for non-metro cities
    let title: string;
    if (metroConfig?.pageTitle) {
      title = metroConfig.pageTitle;
    } else {
      const top2Names = response.data.beaches
        .slice(0, 2)
        .map((b: { name: string }) => b.name);
      if (top2Names.length >= 2) {
        title = truncateTitleForSEO(
          `${displayCityName}, ${expandedState} Surf: ${stats.totalBeaches} Breaks Including ${top2Names[0]} & ${top2Names[1]}`
        );
      } else {
        title = `Best Surf Beaches in ${displayCityName}, ${expandedState}`;
      }
    }

    const topBeachNames = response.data.beaches
      .slice(0, 3)
      .map((b: { name: string }) => b.name)
      .join(", ");

    const ratingSnippet =
      stats.totalReviews >= 5
        ? ` Rated ${stats.averageRating.toFixed(1)}/5 from ${stats.totalReviews} reviews.`
        : "";

    const description = metroConfig?.description
      ? `${metroConfig.description}${ratingSnippet || ` ${stats.totalBeaches} surf spots with forecasts, tides & crowd intel.`}`
      : `${stats.totalBeaches} surf spots in ${displayCityName}: ${topBeachNames} and more.${ratingSnippet} Forecasts, tide charts, crowd levels & best surf windows.`;

    const isUsa = params.country.toLowerCase() === "usa";
    const canonicalPath =
      isUsa && isValidStateSlug(params.state)
        ? `/beaches/usa/${params.state}/${params.city}`
        : `/beaches/${params.country}/${params.state}/${params.city}`;
    const url = `${SITE_ORIGIN}${canonicalPath}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: "Quiver",
        images: [
          {
            url: "/images/og-location-default.jpg",
            width: 1200,
            height: 630,
            alt: `Surf beaches in ${displayCityName}, ${expandedState}`,
          },
        ],
        locale: "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ["/images/og-location-default.jpg"],
      },
      alternates: {
        canonical: url,
      },
    };
  } catch (error) {
    // Handle errors gracefully during build
    console.error("[generateMetadata] Error:", error);
    return {
      title: "Surf Beaches",
      description: "Discover surf beaches and conditions on Quiver",
    };
  }
}

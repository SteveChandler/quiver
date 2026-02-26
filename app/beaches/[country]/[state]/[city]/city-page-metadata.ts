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

    // Inline helpers for aggregating break types and skill range from beach data
    function aggregateBreakTypes(
      beaches: Array<{ break_type?: string | null }>
    ): string | null {
      const capitalize = (s: string) =>
        s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      const unique = [
        ...new Set(
          beaches
            .map((b) => b.break_type)
            .filter((t): t is string => t != null && t.trim() !== "")
        ),
      ].map(capitalize);
      if (unique.length === 0) return null;
      if (unique.length === 1) return unique[0];
      if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
      return `${unique.slice(0, -1).join(", ")} & ${unique[unique.length - 1]}`;
    }

    function getSkillRange(
      beaches: Array<{ skill_level?: string | null }>
    ): string | null {
      const order = ["beginner", "intermediate", "advanced", "expert"];
      const capitalize = (s: string) =>
        s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      const present = beaches
        .map((b) => b.skill_level?.toLowerCase().trim())
        .filter((s): s is string => s != null && order.includes(s));
      if (present.length === 0) return null;
      const indices = present.map((s) => order.indexOf(s));
      const lowestIdx = Math.min(...indices);
      const highestIdx = Math.max(...indices);
      if (lowestIdx === highestIdx) return capitalize(order[lowestIdx]);
      return `${capitalize(order[lowestIdx])} to ${capitalize(order[highestIdx])}`;
    }

    const breakTypes = aggregateBreakTypes(response.data.beaches);
    const skillRange = getSkillRange(response.data.beaches);
    const n = stats.totalBeaches;

    // Build title with 3-tier fallback for non-metro cities
    let title: string;
    if (metroConfig) {
      // For metro areas, prefer an enriched title with beach count and break types
      // which gives Google more indexable keywords and a more descriptive snippet.
      if (breakTypes !== null) {
        const metroTier1 = `${n} ${metroConfig.displayName} Surf Spots: ${breakTypes}`;
        title = metroTier1.length <= 60 ? metroTier1 : truncateTitleForSEO(metroTier1);
      } else if (metroConfig.pageTitle) {
        title = metroConfig.pageTitle;
      } else {
        title = `Best Surf Beaches in ${metroConfig.displayName}`;
      }
    } else {
      const fallback = `Best Surf Beaches in ${displayCityName}, ${expandedState}`;
      // Tier 1: count + break types
      if (breakTypes !== null) {
        const tier1 = `${displayCityName}, ${expandedState}: ${n} Surf Breaks | ${breakTypes}`;
        if (tier1.length <= 60) {
          title = tier1;
        } else if (skillRange !== null) {
          // Tier 2: count + skill range
          const tier2 = `${displayCityName}, ${expandedState}: ${n} Breaks, ${skillRange}`;
          title = tier2.length <= 60 ? tier2 : truncateTitleForSEO(tier2);
        } else {
          title = fallback;
        }
      } else if (skillRange !== null) {
        // Tier 2: count + skill range (no break types available)
        const tier2 = `${displayCityName}, ${expandedState}: ${n} Breaks, ${skillRange}`;
        title = tier2.length <= 60 ? tier2 : truncateTitleForSEO(tier2);
      } else {
        title = fallback;
      }
    }

    // Build description progressively for non-metro cities
    const topBeaches = response.data.beaches
      .slice(0, 3)
      .map((b: { name: string }) => b.name);

    const MAX_DESC_LENGTH = 160;
    let description: string;
    if (metroConfig?.description) {
      const ratingSnippet =
        stats.totalReviews >= 5
          ? ` Rated ${stats.averageRating.toFixed(1)}/5.`
          : "";
      const suffix = ratingSnippet || ` ${n} surf spots with forecasts, tides & crowd intel.`;
      const full = `${metroConfig.description}${suffix}`;
      if (full.length <= MAX_DESC_LENGTH) {
        description = full;
      } else if (metroConfig.description.length <= MAX_DESC_LENGTH) {
        description = metroConfig.description;
      } else {
        // Trim the metro description itself to fit within 160 chars
        const trimmed = metroConfig.description.slice(0, MAX_DESC_LENGTH - 1);
        const lastSpace = trimmed.lastIndexOf(" ");
        description = lastSpace > MAX_DESC_LENGTH * 0.6
          ? trimmed.slice(0, lastSpace) + "."
          : trimmed + ".";
      }
    } else {
      // Core sentence varies by what data is available
      const breakNoun = n === 1 ? "break" : "breaks";
      let core: string;
      if (skillRange !== null && breakTypes !== null) {
        core = `${n} surf ${breakNoun} in ${displayCityName} from ${skillRange.toLowerCase()} ${breakTypes.toLowerCase()} ${breakNoun}.`;
      } else if (skillRange !== null) {
        core = `${n} surf ${breakNoun} in ${displayCityName} from ${skillRange.toLowerCase()}.`;
      } else if (breakTypes !== null) {
        core = `${n} ${breakTypes.toLowerCase()} ${breakNoun} in ${displayCityName}.`;
      } else {
        core = `${n} surf ${breakNoun} in ${displayCityName}.`;
      }

      // Append beach names
      const namesWithMore =
        topBeaches.length > 0
          ? ` ${topBeaches.join(", ")} and more.`
          : "";
      const suffix = " Live forecasts & crowd intel.";
      const ratingSnippet =
        stats.totalReviews >= 5
          ? ` Rated ${stats.averageRating.toFixed(1)}/5.`
          : "";

      const full = `${core}${namesWithMore}${ratingSnippet}${suffix}`;

      if (full.length <= 160) {
        description = full;
      } else {
        // Drop rating first
        const withoutRating = `${core}${namesWithMore}${suffix}`;
        if (withoutRating.length <= 160) {
          description = withoutRating;
        } else {
          // Drop "and more" from beach names
          description = `${core}${suffix}`;
        }
      }
    }

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

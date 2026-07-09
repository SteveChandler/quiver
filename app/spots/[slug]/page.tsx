import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  type SurfSpotSlug,
} from "@/lib/data/surf-spots";
import { buildPageMetadata, buildDynamicBeachMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getBeachForecastPreview } from "@/actions/forecast-actions";
import { getSpotDataBySlug } from "@/actions/spot/spot-data-actions";

export const revalidate = 3600;

interface SpotPageParams {
  params: Promise<{ slug: SurfSpotSlug }>;
}

export async function generateMetadata(props: SpotPageParams): Promise<Metadata> {
  const params = await props.params;
  const { data: spot, dbHasLocation } = await getSpotDataBySlug(params.slug);
  if (!spot) {
    return buildNoindexSpotMetadata(params.slug);
  }

  const canonicalPath = getCanonicalSpotPath(spot, dbHasLocation);
  if (!canonicalPath) {
    return buildNoindexSpotMetadata(params.slug);
  }

  const cityName = spot.city || spot.region?.split(",")[0] || "Southern California";
  const regionName = spot.region?.split(",")[0] || "";

  // Fetch live forecast data for dynamic meta
  let forecastData: { wave_height?: string | null } | null = null;
  if (spot.id) {
    const forecastResult = await getBeachForecastPreview(spot.id);
    if (forecastResult.success && forecastResult.data?.wave_height) {
      forecastData = { wave_height: forecastResult.data.wave_height };
    }
  }

  // Use CTR-optimized dynamic metadata (same as hierarchical pages)
  // SpotPageData uses camelCase (breakType, skillLevel) and lacks wave_tips,
  // crowd_level, average_rating, review_count — those fields yield undefined (safe fallthrough)
  const { title, description } = buildDynamicBeachMetadata({
    beach: {
      name: spot.name,
      city: spot.city,
      state: spot.state || regionName,
      break_type: spot.breakType ?? null,
      skill_level: spot.skillLevel || null,
      description_excerpt: spot.description
        ? (spot.description.split(/\.(\s|$)/)[0] + ".").trim() || null
        : null,
      wave_tips: (spot as any).wave_tips ?? null,
      crowd_level: (spot as any).crowd_level ?? null,
      average_rating: (spot as any).average_rating ?? null,
      review_count: (spot as any).review_count ?? null,
    },
    forecast: forecastData,
  });

  const metadata = buildPageMetadata({
    title,
    description,
    path: canonicalPath,
    image: `/api/og/beach?slug=${params.slug}`,
    keywords: [
      `${spot.name} surf report`,
      `${spot.name} surf forecast`,
      `${spot.name} surf conditions`,
      `${spot.name} tides`,
      `${spot.name} wave height`,
      `${cityName} surf`,
      `${cityName} surf report`,
      `${regionName} surf spots`,
      "surf report",
      "surf forecast",
      "surf conditions",
      "wave height today",
    ].filter(Boolean),
  });

  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}

export default function SpotPage() {
  return notFound();
}

function getCanonicalSpotPath(
  spot: {
    slug?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  },
  dbHasLocation: boolean,
): string | null {
  if (!dbHasLocation || !spot.slug || !spot.city || !spot.state) {
    return null;
  }

  const canonicalPath = buildBeachUrl({
    slug: spot.slug,
    city: spot.city,
    state: spot.state,
    country: spot.country,
  });

  return canonicalPath.startsWith("/beach/") ? null : canonicalPath;
}

function buildNoindexSpotMetadata(slug: string): Metadata {
  const metadata = buildPageMetadata({
    title: "Spot Not Found",
    description: "This surf spot page could not be found.",
    path: `/spots/${slug}`,
  });

  return {
    ...metadata,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

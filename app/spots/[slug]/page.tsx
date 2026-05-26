import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  type SurfSpotSlug,
  type SurfCitySlug,
} from "@/lib/data/surf-spots";
import { buildPageMetadata, buildDynamicBeachMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getBeachForecastPreview } from "@/actions/forecast-actions";
import { SpotStructuredData } from "@/components/seo/spot-structured-data";
import {
  getSpotDataBySlug,
  getSpotFeaturedPhoto,
} from "@/actions/spot/spot-data-actions";
import { SpotPageContent } from "@/components/spots";

export const revalidate = 3600;

function formatPacificDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

interface SpotPageParams {
  params: Promise<{ slug: SurfSpotSlug }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: SpotPageParams): Promise<Metadata> {
  const params = await props.params;
  const { data: spot, dbHasLocation } = await getSpotDataBySlug(params.slug);
  if (!spot) {
    return {};
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

  // Canonical path matches sitemap logic:
  // - Use hierarchical URL when DB has complete location data
  // - Fall back to /spots/{slug} when location data is incomplete
  // Note: dbHasLocation guarantees non-empty city and state in the DB record
  const canonicalPath = dbHasLocation && spot.slug
    ? buildBeachUrl({ slug: spot.slug, city: spot.city!, state: spot.state! })
    : `/spots/${spot.slug}`;

  return buildPageMetadata({
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
}

export default async function SpotPage(props: SpotPageParams) {
  const params = await props.params;
  const { data: spot } = await getSpotDataBySlug(params.slug);
  if (!spot) {
    return notFound();
  }

  // This page renders at /spots/{slug} — the generateMetadata canonical points to
  // the hierarchical URL, so crawlers receive the correct canonical signal.

  // Get city name from spot data (database-driven)
  const cityName = spot.city || spot.region?.split(",")[0] || "Southern California";

  const featuredPhotoPromise = spot.id ? getSpotFeaturedPhoto(spot.id) : Promise.resolve(null);

  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const nearbySpotDataPromise = spot.nearby
    ? Promise.all(
        spot.nearby.map(async (nearbySlug) => {
          const { data: nearbySpot } = await getSpotDataBySlug(nearbySlug);
          if (!nearbySpot) {
            return null;
          }

          const nearbyPhoto = nearbySpot.id
            ? await getSpotFeaturedPhoto(nearbySpot.id)
            : null;

          return {
            slug: nearbySpot.slug,
            name: nearbySpot.name,
            city: nearbySpot.city,
            state: nearbySpot.state,
            region: nearbySpot.region,
            overview: nearbySpot.overview,
            breakType: nearbySpot.breakType,
            skillLevel: nearbySpot.skillLevel,
            tideAdvice: nearbySpot.tideAdvice,
            swellAdvice: nearbySpot.swellAdvice,
            windAdvice: nearbySpot.windAdvice,
            photoUrl: nearbyPhoto?.imageUrl ?? null,
          };
        })
      )
    : Promise.resolve([]);

  const [featuredPhoto, nearbySpotData] = await Promise.all([
    featuredPhotoPromise,
    nearbySpotDataPromise,
  ]);
  const validNearbySpots = nearbySpotData.filter((nearbySpot) => nearbySpot !== null);

  return (
    <div className="bg-white">
      <SpotStructuredData
        spot={{
          slug: spot.slug,
          name: spot.name,
          coordinates: {
            lat: spot.latitude || 0,
            lon: spot.longitude || 0,
          },
          speakableSummary: spot.speakableSummary || spot.overview || "",
          faq: spot.faq || [],
          citySlug: spot.citySlug || ("san-diego" as SurfCitySlug),
          region: spot.region || "",
          overview: spot.overview || "",
          history: spot.history || "",
          conditions: spot.conditions || "",
          tideAdvice: spot.tideAdvice || "",
          swellAdvice: spot.swellAdvice || "",
          windAdvice: spot.windAdvice || "",
          waterTemp: spot.waterTemp || "",
          hazards: spot.hazards || [],
          skillLevel: (spot.skillLevel as any) || "Intermediate",
          bestSeason: spot.bestSeason || "",
          crowdFactor: spot.crowdFactor || "Moderate",
          parking: spot.parking || "",
          amenities: spot.amenities || [],
          nearby: spot.nearby || [],
          intentTags: (spot.intentTags as any) || [],
        }}
        cityName={cityName}
        citySlug={spot.citySlug || undefined}
        baseUrl={baseUrl}
      />
      <SpotPageContent
        spot={spot}
        cityName={cityName}
        updatedAt={updatedAt}
        featuredPhotoUrl={featuredPhoto?.imageUrl || null}
        featuredPhotoAttribution={featuredPhoto?.attributionHtml}
        nearbySpots={validNearbySpots}
      />
    </div>
  );
}

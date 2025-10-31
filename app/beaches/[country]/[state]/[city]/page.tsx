/**
 * Location Listing Page
 *
 * Displays all beaches in a specific city/state/country with ranking.
 * Example URLs:
 * - /beaches/usa/ca/la-jolla-san-diego
 * - /beaches/usa/ca/newport-beach
 * - /beaches/mexico/baja-california/rosarito
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, MapPin, Star } from "lucide-react";
import { getLocationPageData, getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { generateLocationSlug } from "@/lib/utils/location-slug";
import { getRankingTier, getRankingBadgeLabel } from "@/types/location";
import { RankingBadge } from "@/components/location/ranking-badge";
import { isMetroArea, getMetroConfig } from "@/lib/constants/metro-areas";

// Dynamically import LocationMap with no SSR since it uses Mapbox (client-only)
const LocationMap = dynamic(
  () => import("@/components/location/location-map").then((mod) => mod.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    )
  }
);

interface LocationPageParams {
  country: string;
  state: string;
  city: string;
}

interface LocationPageProps {
  params: LocationPageParams;
}

export default async function LocationPage({ params }: LocationPageProps) {
  // Fetch location page data
  const response = await getLocationPageData(
    params.city,
    params.state,
    params.country
  );

  if (!response.success || !response.data) {
    notFound();
  }

  const { location, stats, beaches } = response.data;

  // Check if this is a metro area page
  const metroConfig = isMetroArea(params.city) ? getMetroConfig(params.city) : null;

  // JSON-LD structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    "name": `${location.city}, ${location.state}`,
    "description": `Surf beaches in ${location.city}, ${location.state}`,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": stats.averageRating,
      "ratingCount": stats.totalReviews,
      "bestRating": 5,
      "worstRating": 1,
    },
    "containsPlace": beaches.slice(0, 5).map((beach) => ({
      "@type": "Beach",
      "name": beach.name,
      "url": `https://quiver.surf/beach/${beach.slug}`,
      "aggregateRating": beach.average_rating > 0 ? {
        "@type": "AggregateRating",
        "ratingValue": beach.average_rating,
        "ratingCount": beach.review_count,
        "bestRating": 5,
        "worstRating": 1,
      } : undefined,
    })),
  };

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm mb-6">
        <Link
          href="/map"
          className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Map
        </Link>
        <span className="text-gray-400 mx-2">›</span>
        <span className="text-gray-900 font-medium">{location.city}, {location.state}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          {metroConfig?.pageTitle || `Best Surf Beaches in ${location.city}`}
        </h1>

        {/* Show metro area info if applicable */}
        {metroConfig && (
          <p className="text-gray-600 mb-4">
            Covering {metroConfig.cities.length} neighborhoods: {metroConfig.cities.join(', ')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-gray-600">
          <div className="flex items-center gap-1">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{stats.averageRating.toFixed(1)}</span>
            <span>·</span>
            <span>{stats.totalReviews} reviews</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-5 w-5" />
            <span>{stats.totalBeaches} beaches</span>
          </div>
          {stats.topBeaches > 0 && (
            <div className="inline-flex items-center gap-1 px-3 py-1 bg-ocean-blue/10 text-ocean-blue rounded-full text-sm font-medium">
              {stats.topBeaches} Top Rated
            </div>
          )}
        </div>
      </header>

      {/* Content Grid: Beach List + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Beaches List (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          {beaches.map((beach) => {
            const tier = getRankingTier(beach.composite_score);
            const badgeLabel = getRankingBadgeLabel(tier);

            return (
              <article
                key={beach.id}
                data-testid="beach-card"
                data-beach-slug={beach.slug}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  {/* Rank Number */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-ocean-blue/10 flex items-center justify-center">
                      <span data-testid="beach-rank" className="text-lg font-bold text-ocean-blue">
                        #{beach.rank}
                      </span>
                    </div>
                  </div>

                  {/* Beach Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/beach/${beach.slug}`}
                          className="text-xl font-semibold text-gray-900 hover:text-ocean-blue transition-colors"
                        >
                          {beach.name}
                        </Link>
                        <RankingBadge tier={tier} label={badgeLabel} />

                        {/* Show neighborhood badge for metro areas */}
                        {metroConfig && beach.city && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {beach.city}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                      {beach.average_rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{beach.average_rating.toFixed(1)}</span>
                          <span>({beach.review_count} reviews)</span>
                        </div>
                      )}
                      {beach.skill_level && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {beach.skill_level}
                        </span>
                      )}
                      {beach.break_type && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {beach.break_type}
                        </span>
                      )}
                      {beach.recent_intel_count > 0 && (
                        <span className="text-green-600 font-medium">
                          {beach.recent_intel_count} recent intel post{beach.recent_intel_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {beach.description && (
                      <p className="text-gray-700 text-sm line-clamp-2 mb-3">
                        {beach.description}
                      </p>
                    )}

                    <Link
                      href={`/beach/${beach.slug}`}
                      className="inline-flex items-center text-sm font-medium text-ocean-blue hover:underline"
                    >
                      View Beach Details →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Map Sidebar (1/3 width on desktop, sticky) */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4">
            <LocationMap
              beaches={beaches}
              city={location.city}
              state={location.state}
            />
          </div>
        </div>
      </div>

      {/* Empty State (shouldn't happen due to notFound check above) */}
      {beaches.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No beaches found in this location.</p>
        </div>
      )}
      </div>
    </>
  );
}

/**
 * Generate static params for all beach locations
 * This enables Next.js to pre-generate all location pages at build time
 */
export async function generateStaticParams() {
  const response = await getAllBeachLocations();

  if (!response.success || !response.data || response.data.length === 0) {
    return [];
  }

  return response.data.map((loc) => ({
    country: generateLocationSlug(loc.country),
    state: generateLocationSlug(loc.state),
    city: generateLocationSlug(loc.city),
  }));
}

/**
 * Configure page metadata
 */
export async function generateMetadata({ params }: LocationPageProps) {
  const metroConfig = isMetroArea(params.city) ? getMetroConfig(params.city) : null;

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

  // Use metro-specific metadata if applicable
  const title = metroConfig?.pageTitle
    ? `${metroConfig.pageTitle} | Quiver`
    : `Best Surf Beaches in ${location.city}, ${location.state} | Quiver`;

  const description = metroConfig?.description
    ? `${metroConfig.description} Average rating: ${stats.averageRating.toFixed(1)}/5 from ${stats.totalReviews} reviews.`
    : `Discover the top ${stats.totalBeaches} surf beaches in ${location.city}. Average rating: ${stats.averageRating.toFixed(1)}/5 from ${stats.totalReviews} reviews.`;

  const url = `https://quiver.surf/beaches/${params.country}/${params.state}/${params.city}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Quiver Surf App",
      images: [
        {
          url: "/images/og-location-default.jpg",
          width: 1200,
          height: 630,
          alt: `Surf beaches in ${location.city}, ${location.state}`,
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
}

/**
 * ISR Configuration: Incremental Static Regeneration
 *
 * Revalidates the page every hour (3600 seconds) to ensure:
 * - Beach rankings stay up-to-date with new reviews
 * - Intel post counts reflect recent activity
 * - Stats update without requiring full deployments
 *
 * This balances performance (static generation) with freshness (hourly updates).
 */
export const revalidate = 3600; // Revalidate every 1 hour

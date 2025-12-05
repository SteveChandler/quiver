/**
 * Popular Beaches Section - Server Component
 *
 * Server-rendered section displaying static beach links for SEO crawlability.
 * This is a simplified, static version of SurfHighlightsSection without client interactivity.
 *
 * Design:
 * - Matches SurfHighlightsSection visual styling
 * - Displays first 8 beaches in 4-column grid
 * - Uses next/image for optimized image loading
 * - All content server-rendered for SEO
 * - Static "Explore All Surf Spots" CTA to /map
 *
 * @module components/landing-page/popular-beaches-section
 */

import Image from "next/image";
import Link from "next/link";
import { MapPin, Waves, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { FALLBACK_IMAGE_BY_NAME } from "@/lib/constants/featured-beaches-config";
import { CONTENT } from "@/lib/constants/features";
import type { EnrichedBeach } from "@/lib/data/server/featured-beaches";

interface PopularBeachesSectionProps {
  beaches: EnrichedBeach[];
}

/**
 * Determine the image URL for a beach using the fallback hierarchy:
 * 1. Beach photo_url (proxied if external)
 * 2. Named fallback from FALLBACK_IMAGE_BY_NAME
 * 3. Default fallback /sunsetBeach.jpg
 */
function getBeachImageUrl(beach: EnrichedBeach): string {
  // Use actual photo if available
  if (beach.photo_url) {
    return getProxiedImageUrl(beach.photo_url);
  }

  // Use named fallback if available
  const fallbackUrl = FALLBACK_IMAGE_BY_NAME[beach.name as keyof typeof FALLBACK_IMAGE_BY_NAME];
  if (fallbackUrl) {
    return fallbackUrl;
  }

  // Default fallback
  return "/sunsetBeach.jpg";
}

/**
 * Beach Card Component - Simplified Static Version
 * No animations, no client interactivity, no state
 */
function BeachCard({ beach }: { beach: EnrichedBeach }) {
  const beachUrl =
    getBeachUrlSafe({
      id: beach.id,
      slug: beach.slug,
      city: beach.city,
      state: beach.state,
    }) || `/beach/${beach.id}`;

  const imageUrl = getBeachImageUrl(beach);
  const location =
    beach.city && beach.state
      ? `${beach.city}, ${beach.state}`
      : beach.city || beach.state || "";

  return (
    <Link href={beachUrl} prefetch={false} className="block group">
      <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
        {/* Image Section */}
        <div className="relative h-48 bg-gradient-to-br from-ocean-blue to-blue-400 overflow-hidden">
          <Image
            src={imageUrl}
            alt={beach.name}
            fill
            loading="lazy"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
          {/* Fallback gradient if image fails */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Waves className="h-16 w-16 text-white/20" />
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4">
          {/* Name */}
          <h3 className="text-lg font-bold font-roboto text-dark-grey mb-1 group-hover:text-ocean-blue transition-colors">
            {beach.name}
          </h3>

          {/* Location */}
          {location && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{location}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Popular Beaches Section - Server Component
 *
 * Displays a grid of beach cards with static links for SEO crawlability.
 * Matches the visual design of SurfHighlightsSection but without client-side features.
 */
export function PopularBeachesSection({ beaches }: PopularBeachesSectionProps) {
  // Display first 8 beaches
  const displayBeaches = beaches.slice(0, 8);

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-roboto font-bold text-dark-grey mb-4">
            {CONTENT.sections.surfHighlights.title}
          </h2>
          <p className="text-xl font-open-sans text-gray-600 max-w-2xl mx-auto">
            {CONTENT.sections.surfHighlights.subtitle}
          </p>
        </div>

        {/* Beach Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {displayBeaches.length > 0 ? (
            displayBeaches.map((beach) => (
              <BeachCard key={beach.id} beach={beach} />
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-500">
              No surf spots available at the moment.
            </div>
          )}
        </div>

        {/* CTA - Explore All Surf Spots */}
        <div className="text-center">
          <Button
            size="lg"
            className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-8 py-4 text-lg font-roboto font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
            asChild
          >
            <Link href="/map">
              Explore All Surf Spots
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SurfSpotCard, SurfSpotCardProps } from "./surf-spot-card";
import { CONTENT } from "@/lib/constants/features";
import { ChevronRight } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { FALLBACK_IMAGE_BY_NAME } from "@/lib/constants/featured-beaches-config";
import { Skeleton } from "@/components/ui/skeleton";

interface Beach {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  slug?: string | null;
  photo_url?: string | null;
  average_rating?: number | null;
  review_count?: number | null;
  skill_level?: string | null;
}

export function SurfHighlightsSection() {
  const [page, setPage] = useState(0);
  const pageSize = 4;

  const fetchBeaches = useCallback(async (): Promise<SurfSpotCardProps[]> => {
    try {
      const response = await fetch("/api/beaches/featured");
      if (!response.ok) {
        throw new Error("Failed to fetch beaches");
      }
      const result = await response.json();
      const beaches: Beach[] = result.data || result;

      // Track used image URLs to prevent duplicates
      const usedImages = new Set<string>();
      const DEFAULT_FALLBACK = "/sunsetBeach.jpg";

      // Transform beaches into surf spot cards.
      // NOTE: We intentionally do NOT show mocked conditions (swell/wind/tide/crowd/etc.)
      // on the landing page to avoid implying forecast accuracy we don't have in this view.
      // Prioritize beaches with actual photos, then unique fallback images
      const spotCards = beaches
        .map((beach, index) => {
          // Determine the image URL
          let imageUrl: string;

          if (beach.photo_url) {
            // Use actual photo from database (proxied for external URLs)
            imageUrl = getProxiedImageUrl(beach.photo_url);
          } else {
            const fallbackUrl =
              FALLBACK_IMAGE_BY_NAME[
                beach.name as keyof typeof FALLBACK_IMAGE_BY_NAME
              ];

            if (fallbackUrl) {
              // Use fallback image if available and not already used
              imageUrl = usedImages.has(fallbackUrl)
                ? DEFAULT_FALLBACK
                : fallbackUrl;
            } else {
              // Use default fallback
              imageUrl = DEFAULT_FALLBACK;
            }
          }

          usedImages.add(imageUrl);

          return {
            id: beach.id,
            name: beach.name,
            location:
              beach.city && beach.state
                ? `${beach.city}, ${beach.state}`
                : beach.city || beach.state || "California",
            slug: beach.slug,
            city: beach.city,
            state: beach.state,
            imageUrl,
            averageRating: beach.average_rating ?? null,
            reviewCount: beach.review_count ?? null,
            skillLevel: beach.skill_level ?? null,
            delay: index,
          };
        })
        .slice(0, 8); // Only take first 8 for display

      return spotCards;
    } catch (error) {
      console.error("Error fetching beaches:", error);
      return [];
    }
  }, []);

  const { data: surfSpots, loading } = useDataFetcher(fetchBeaches);

  const total = surfSpots?.length ?? 0;
  const pageCount = useMemo(() => {
    if (!surfSpots || surfSpots.length === 0) return 0;
    return Math.ceil(surfSpots.length / pageSize);
  }, [surfSpots, pageSize]);

  const visibleSpots = useMemo(() => {
    if (!surfSpots || surfSpots.length === 0) return [];
    const start = page * pageSize;
    return surfSpots.slice(start, start + pageSize);
  }, [surfSpots, page, pageSize]);

  // Reset to first page if data changes and current page is out of range.
  useEffect(() => {
    if (!surfSpots || surfSpots.length === 0) {
      setPage(0);
      return;
    }
    const maxPage = Math.max(0, Math.ceil(surfSpots.length / pageSize) - 1);
    if (page > maxPage) setPage(0);
  }, [surfSpots, page, pageSize]);

  const handleNext = () => {
    if (pageCount <= 1) return;
    setPage((prev) => (prev + 1) % pageCount);
  };

  return (
    <section className="py-14 bg-gradient-to-b from-white to-blue-50/50">
      <div className="max-w-7xl mx-auto px-6">
        {/* AllTrails-style editorial header - left-aligned with location emphasis */}
        <h2 className="text-2xl md:text-3xl font-roboto font-semibold text-dark-grey mb-8 text-left">
          Popular surf spots
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {visibleSpots.length > 0 ? (
                visibleSpots.map((spot, index) => (
                  <SurfSpotCard key={spot.id} {...spot} delay={index} />
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No surf spots available at the moment.
                </div>
              )}
            </div>

            {/* AllTrails-style floating carousel control */}
            {total > pageSize && (
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next surf spots"
                className="hidden md:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow z-10 border border-gray-100"
              >
                <ChevronRight className="h-5 w-5 text-dark-grey" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

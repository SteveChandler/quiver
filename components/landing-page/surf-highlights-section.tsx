"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SurfSpotCard, SurfSpotCardProps } from "./surf-spot-card";
import { CONTENT } from "@/lib/constants/features";
import { ChevronRight } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocationSafe } from "@/context/location-context";

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
  score?: number | null;
  wave_height?: number | null;
}

export function SurfHighlightsSection() {
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const locationCtx = useLocationSafe();
  const location = locationCtx?.location;
  const coordinates = location?.coordinates ?? null;

  // Serialize coordinates to a stable string to use as dependency (rounded for privacy + cacheability)
  const coordsKey = coordinates
    ? `${coordinates.lat.toFixed(2)},${coordinates.lon.toFixed(2)}`
    : "";

  const fetchBeaches = useCallback(async (): Promise<SurfSpotCardProps[]> => {
    try {
      let url = "/api/beaches/featured";
      if (coordsKey) {
        const [lat, lon] = coordsKey.split(",");
        url += `?lat=${lat}&lon=${lon}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch beaches");
      }
      const result = await response.json();
      const beaches: Beach[] = result.data || result;

      // Only show beaches with working photos — skip those without.
      // Google Places photo URLs require server-side API key auth and
      // always 404 when loaded from the client / image proxy.
      const spotCards = beaches
        .filter(
          (beach) =>
            beach.photo_url &&
            !beach.photo_url.includes("places.googleapis.com")
        )
        .map((beach, index) => {
          const imageUrl = getProxiedImageUrl(beach.photo_url!);

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
            score: beach.score ?? null,
            waveHeight: beach.wave_height ?? null,
            delay: index,
          };
        })
        .slice(0, 8); // Only take first 8 for display

      return spotCards;
    } catch (error) {
      console.error("Error fetching beaches:", error);
      return [];
    }
  }, [coordsKey]);

  const { data: surfSpots, loading, refetch } = useDataFetcher(fetchBeaches);

  // Re-fetch when coordinates resolve (useDataFetcher only fires on mount)
  const initialCoordsRef = useRef(coordsKey);
  useEffect(() => {
    if (coordsKey && coordsKey !== initialCoordsRef.current) {
      initialCoordsRef.current = coordsKey;
      refetch();
    }
  }, [coordsKey, refetch]);

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
    <section className="py-14 bg-[#252D6B] noise-texture">
      <div className="max-w-7xl mx-auto px-6">
        {/* Editorial header */}
        <h2 className="text-2xl md:text-3xl font-heading font-semibold text-white mb-8 text-left">
          {CONTENT.sections.surfHighlights.title}
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
                <div className="col-span-full text-center py-12 text-medium">
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
                className="hidden md:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#354090] shadow-md hover:shadow-lg transition-shadow z-10 border border-[#404C92]"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        )}

        {/* Browse all spots link */}
        <div className="mt-8 text-left">
          <Link
            href="/ca/san-diego"
            className="text-ocean-blue font-sans font-medium hover:text-ocean-blue/80 transition-colors underline-offset-4 hover:underline"
          >
            Browse all surf spots &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

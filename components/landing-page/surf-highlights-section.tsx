"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SurfSpotCard, SurfSpotCardProps } from "./surf-spot-card";
import { ChevronRight, MapPin } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocationSafe } from "@/context/location-context";

interface Beach {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  slug?: string | null;
  photo_url?: string | null;
  average_rating?: number | null;
  review_count?: number | null;
  skill_level?: string | null;
  score?: number | null;
  wave_height?: string | number | null;
}

const LANDING_SCORE_BADGE_MINIMUM = 60;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface FetchResult {
  spots: SurfSpotCardProps[];
  isNearby: boolean;
}

interface SurfHighlightsSectionProps {
  trustProof?: boolean;
}

export function SurfHighlightsSection({
  trustProof = false,
}: SurfHighlightsSectionProps = {}) {
  const [page, setPage] = useState(0);
  const pageSize = trustProof ? 3 : 4;
  const locationCtx = useLocationSafe();
  const location = locationCtx?.location;
  const hasPreciseLocation = locationCtx?.hasPreciseLocation ?? false;
  const requestPreciseLocation = locationCtx?.requestPreciseLocation;
  const locationError = locationCtx?.locationError ?? null;
  const clearError = locationCtx?.clearError;
  const [requesting, setRequesting] = useState(false);
  // Don't use coordinates until location has resolved (avoids race with default SD coords)
  const coordinates = location && !location.isLoading ? location.coordinates : null;

  // Serialize coordinates to a stable string to use as dependency (rounded for privacy + cacheability)
  const coordsKey = coordinates
    ? `${coordinates.lat.toFixed(2)},${coordinates.lon.toFixed(2)}`
    : "";

  const fetchBeaches = useCallback(async (): Promise<FetchResult> => {
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
      const payload = result.data || result;
      const beaches: Beach[] = payload.beaches || payload;
      const isNearby: boolean = payload.isNearby ?? false;

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
                : beach.city || beach.state || "USA",
            slug: beach.slug,
            city: beach.city,
            state: beach.state,
            country: beach.country,
            imageUrl,
            averageRating: beach.average_rating ?? null,
            reviewCount: beach.review_count ?? null,
            skillLevel: beach.skill_level ?? null,
            score:
              typeof beach.score === "number" &&
              beach.score >= LANDING_SCORE_BADGE_MINIMUM
                ? beach.score
                : null,
            waveHeight: beach.wave_height ?? null,
            delay: index,
          };
        })
        .slice(0, 8); // Only take first 8 for display

      return { spots: spotCards, isNearby };
    } catch (error) {
      return { spots: [], isNearby: false };
    }
  }, [coordsKey]);

  const locationLoading = location?.isLoading !== false;
  const { data: fetchResult, loading } = useDataFetcher(fetchBeaches, { skip: locationLoading });
  const surfSpots = fetchResult?.spots ?? null;
  const isNearby = fetchResult?.isNearby ?? false;

  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const shouldReduceMotion = useReducedMotion();

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

  const easeOutQuart: [number, number, number, number] = [0.25, 1, 0.5, 1];

  const handleRequestLocation = async () => {
    if (!requestPreciseLocation) return;
    clearError?.();
    setRequesting(true);
    try {
      await requestPreciseLocation();
    } finally {
      setRequesting(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      className={
        trustProof
          ? "bg-background noise-texture border-t border-white/[0.06] pb-12 pt-12 md:pb-14 md:pt-16"
          : "pt-16 pb-8 md:pt-24 md:pb-10 bg-[#252D6B] noise-texture border-t border-white/[0.06]"
      }
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-10 grid gap-6 md:mb-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <motion.h2
            className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-white text-left"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={
              shouldReduceMotion
                ? {}
                : { opacity: isInView ? 1 : 0, y: isInView ? 0 : 16 }
            }
            transition={{ duration: 0.5, ease: easeOutQuart }}
          >
            {trustProof
              ? "Proof Quiver knows real beaches"
              : "Start with the beach, not the buoy chart"}
          </motion.h2>

          <motion.p
            className="max-w-2xl text-base leading-relaxed text-[#B8C7E0] md:col-span-2"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={shouldReduceMotion ? {} : { opacity: isInView ? 1 : 0 }}
            transition={{ duration: 0.45, ease: easeOutQuart, delay: 0.18 }}
          >
            {isNearby
              ? "Nearby spots are labeled by difficulty so a newer surfer can spot the mellow options first."
              : trustProof
                ? "Real spot pages stay here as local proof. The first decision is still the app handoff, not a web browsing maze."
                : "Difficulty labels are now front and center. Start with beginner-friendly beaches, then open the full forecast when you are ready for the details."}
          </motion.p>

          {!trustProof && !hasPreciseLocation && requestPreciseLocation && !loading && !locationLoading && (
            <motion.div
              className="flex items-center gap-3 flex-wrap md:col-span-2"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={shouldReduceMotion ? {} : { opacity: isInView ? 1 : 0 }}
              transition={{ duration: 0.4, ease: easeOutQuart, delay: 0.2 }}
            >
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={requesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/[0.08] text-[#9AABC6] hover:bg-white/[0.14] hover:text-white border border-white/[0.1] transition-[color,background-color,border-color,box-shadow,opacity] duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              >
                <MapPin size={14} />
                {requesting ? "Locating\u2026" : "Show spots near me"}
              </button>
              {locationError && (
                <span role="alert" className="text-sm text-amber-400/80">
                  {locationError}
                </span>
              )}
            </motion.div>
          )}
        </div>

        {loading || locationLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl bg-white/[0.06]" />
            ))}
          </div>
        ) : (
          <div className="relative">
            <div
              className={
                trustProof
                  ? "grid grid-cols-1 gap-5 md:grid-cols-3"
                  : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              }
            >
              {visibleSpots.length > 0 ? (
                visibleSpots.map((spot, index) => (
                  <motion.div
                    key={spot.id}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={
                      shouldReduceMotion
                        ? {}
                        : {
                            opacity: isInView ? 1 : 0,
                            y: isInView ? 0 : 20,
                          }
                    }
                    transition={{
                      duration: 0.5,
                      ease: easeOutQuart,
                      delay: shouldReduceMotion ? 0 : 0.2 + index * 0.1,
                    }}
                    className="h-full"
                  >
                    <SurfSpotCard key={spot.id} {...spot} delay={index} />
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-[#9AABC6]">
                  No surf spots available at the moment.
                </div>
              )}
            </div>

            {/* Floating carousel control */}
            {total > pageSize && (
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next surf spots"
                className="hidden md:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/[0.08] shadow-md hover:shadow-lg hover:bg-white/[0.15] transition-[background-color,box-shadow] duration-300 z-10 border border-white/[0.1] focus-ring"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        )}

        {/* Browse all spots link */}
        <motion.div
          className="mt-8 text-left"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={
            shouldReduceMotion ? {} : { opacity: isInView ? 1 : 0 }
          }
          transition={{
            duration: 0.5,
            ease: easeOutQuart,
            delay: shouldReduceMotion ? 0 : 0.6,
          }}
        >
          <Link
            href="/map"
            className={
              trustProof
                ? "font-heading text-sm font-bold text-foreground/70 transition-colors underline-offset-4 hover:text-foreground hover:underline"
                : "font-heading text-sm font-bold text-[#F78E42] transition-colors underline-offset-4 hover:text-[#FDB84B] hover:underline"
            }
          >
            Browse all surf spots &rarr;
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

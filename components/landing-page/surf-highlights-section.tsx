"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
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

// ---------------------------------------------------------------------------
// Animated count-up number
// ---------------------------------------------------------------------------

const STATS = [
  { value: 30, suffix: "K+", label: "Buoy Observations" },
  { value: 350, suffix: "+", label: "Surf Spots" },
  { value: 10, suffix: "K+", label: "Sessions Logged" },
] as const;

function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const duration = 1200; // ms
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SurfHighlightsSection() {
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const locationCtx = useLocationSafe();
  const location = locationCtx?.location;
  const coordinates = location?.coordinates ?? null;
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.3 });
  const reducedMotion = useReducedMotion();

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
    <section className="pt-16 pb-8 md:pt-24 md:pb-10 bg-[#252D6B] noise-texture border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Social proof stats bar */}
        <motion.div
          ref={statsRef}
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={statsInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mb-14"
        >
          {STATS.map((stat, i) => (
            <div key={stat.label} className="text-center">
              <motion.p
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={statsInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.4, delay: i * 0.15 }}
                className="text-3xl md:text-4xl font-heading font-bold text-white"
              >
                <CountUp target={stat.value} suffix={stat.suffix} />
              </motion.p>
              <p className="text-sm text-[#B0C0D6] mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Section header */}
        <h2 className="text-2xl md:text-3xl font-heading font-semibold text-white mb-8 text-left">
          {CONTENT.sections.surfHighlights.title}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl bg-white/[0.06]" />
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
                className="hidden md:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/[0.08] shadow-md hover:shadow-lg hover:bg-white/[0.15] transition-all duration-300 z-10 border border-white/[0.1]"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        )}

        {/* Browse all spots link */}
        <div className="mt-8 text-left">
          <Link
            href="/map"
            className="text-[#4A70D9] font-sans font-medium hover:text-ocean-blue transition-colors underline-offset-4 hover:underline"
          >
            Browse all surf spots &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

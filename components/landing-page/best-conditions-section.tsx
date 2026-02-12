"use client";

import { useCallback, useEffect, useRef } from "react";
import { SurfSpotCard } from "@/components/landing-page/surf-spot-card";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  getTopBeachesRightNow,
  type TopBeachEntry,
} from "@/lib/utils/forecast-hub-utils";
import {
  trackBestConditionsClick,
  trackBestConditionsViewed,
} from "@/lib/analytics/engagement-tracking";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { FALLBACK_IMAGE_BY_NAME } from "@/lib/constants/featured-beaches-config";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_FALLBACK = "/sunsetBeach.jpg";

function resolveImageUrl(entry: TopBeachEntry): string {
  if (entry.imageUrl) {
    return getProxiedImageUrl(entry.imageUrl);
  }
  const fallback =
    FALLBACK_IMAGE_BY_NAME[
      entry.beachName as keyof typeof FALLBACK_IMAGE_BY_NAME
    ];
  return fallback || DEFAULT_FALLBACK;
}

export function BestConditionsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);

  const fetchTopBeaches = useCallback(async (): Promise<TopBeachEntry[]> => {
    return getTopBeachesRightNow(6);
  }, []);

  const { data: entries, loading } = useDataFetcher(fetchTopBeaches);

  // Track section view via IntersectionObserver
  useEffect(() => {
    if (!entries || entries.length === 0 || hasTrackedView.current) return;
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          trackBestConditionsViewed(entries.length, false);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [entries]);

  if (!loading && (!entries || entries.length === 0)) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="py-14 bg-gradient-to-b from-white to-blue-50/50"
    >
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-2xl md:text-3xl font-roboto font-semibold text-dark-grey mb-2 text-left">
          Best conditions right now
        </h2>
        <p className="text-sm text-gray-500 mb-8">
          Highest-scored surf spots based on live swell, wind, and tide data
        </p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {entries?.map((entry, index) => (
              <div
                key={entry.beachId}
                onClick={() =>
                  trackBestConditionsClick(entry.beachName, index + 1, entry.score)
                }
              >
                <SurfSpotCard
                  id={entry.beachId}
                  name={entry.beachName}
                  location={entry.regionName}
                  slug={entry.slug}
                  city={entry.city}
                  state={entry.state}
                  imageUrl={resolveImageUrl(entry)}
                  score={entry.score}
                  waveHeight={entry.waveHeight}
                  averageRating={entry.averageRating}
                  skillLevel={entry.skillLevel}
                  delay={index}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

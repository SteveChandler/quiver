"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SurfSpotCard } from "@/components/landing-page/surf-spot-card";
import {
  trackNearbyBeachClick,
  trackNearbyBeachesViewed,
} from "@/lib/analytics/engagement-tracking";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import type { EnrichedNearbyBeach } from "@/lib/utils/nearby-beach-enrichment";

interface NearbyBeachesEnrichedProps {
  beaches: EnrichedNearbyBeach[];
  sourceBeachName: string;
  sourceBeachLat?: number | null;
  sourceBeachLon?: number | null;
  className?: string;
}

export function NearbyBeachesEnriched({
  beaches,
  sourceBeachName,
  sourceBeachLat,
  sourceBeachLon,
  className,
}: NearbyBeachesEnrichedProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);

  // Track when section enters viewport (fire once)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || beaches.length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          trackNearbyBeachesViewed(sourceBeachName, beaches.length);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [sourceBeachName, beaches.length]);

  if (!beaches || beaches.length === 0) return null;

  const mapLink =
    sourceBeachLat != null && sourceBeachLon != null
      ? `/map?lat=${sourceBeachLat}&lon=${sourceBeachLon}&zoom=12`
      : "/map";

  return (
    <section ref={sectionRef} className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Nearby Surf Spots
        </h2>
        <Link
          href={mapLink}
          className="text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
        >
          Explore all nearby spots
        </Link>
      </div>

      {/* Desktop: grid layout */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {beaches.map((beach, index) => (
          <div
            key={beach.id}
            onClick={() =>
              trackNearbyBeachClick(
                beach.name,
                index + 1,
                beach.score ?? 0
              )
            }
          >
            <SurfSpotCard
              id={beach.id}
              name={beach.name}
              location={getBeachLocation(beach)}
              slug={beach.slug}
              city={beach.city}
              state={beach.state}
              imageUrl={beach.photoUrl}
              score={beach.score}
              waveHeight={beach.waveHeight}
              skillLevel={beach.skill_level}
              delay={index}
            />
          </div>
        ))}
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        <div className="flex gap-4" style={{ width: "max-content" }}>
          {beaches.map((beach, index) => (
            <div
              key={beach.id}
              className="snap-start min-w-[280px] max-w-[300px]"
              onClick={() =>
                trackNearbyBeachClick(
                  beach.name,
                  index + 1,
                  beach.score ?? 0
                )
              }
            >
              <SurfSpotCard
                id={beach.id}
                name={beach.name}
                location={getBeachLocation(beach)}
                slug={beach.slug}
                city={beach.city}
                state={beach.state}
                imageUrl={beach.photoUrl}
                score={beach.score}
                waveHeight={beach.waveHeight}
                skillLevel={beach.skill_level}
                delay={index}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

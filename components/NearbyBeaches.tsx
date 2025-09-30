"use client";

import { useMemo } from "react";
import { BeachCard } from "@/components/beach-card";
import { useNearbyBeaches } from "@/hooks/useNearbyBeaches";
import { useSelectedBeach } from "@/state/selectedBeach";
import { formatMiles } from "@/utils/distance";

interface NearbyBeachesProps {
  limit?: number;
}

export function NearbyBeaches({ limit = 4 }: NearbyBeachesProps) {
  const { selectedBeach } = useSelectedBeach();
  const lat = selectedBeach?.lat ?? selectedBeach?.latitude ?? undefined;
  const lon = selectedBeach?.lon ?? selectedBeach?.longitude ?? undefined;

  const { data: beaches, isLoading } = useNearbyBeaches(lat, lon, limit);

  const otherBeaches = useMemo(() => {
    if (!selectedBeach) return [];
    return (beaches ?? [])
      .filter((b) => b.id !== selectedBeach.id)
      .slice(0, limit);
  }, [beaches, selectedBeach, limit]);

  if (!selectedBeach) return null;

  const headerLabel = `${Math.min(limit, Math.max(0, otherBeaches.length))} other nearby beaches`;

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{headerLabel}</h3>
      </header>

      {isLoading ? (
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {otherBeaches.map((beach) => {
            const distanceMiles =
              typeof beach.meters === "number"
                ? beach.meters / 1609.344
                : undefined;
            const distanceLabel =
              typeof distanceMiles === "number" && distanceMiles >= 0.1
                ? formatMiles(distanceMiles)
                : "";

            return (
              <BeachCard
                key={beach.id}
                id={beach.id}
                name={beach.name}
                distance={distanceLabel}
                rating={
                  typeof beach.rating === "number" ? beach.rating : Number.NaN
                }
                reviewCount={beach.reviewCount ?? 0}
                imageUrl={
                  beach.imageUrl ?? "/images/beach-placeholder.jpg"
                }
                latitude={beach.lat ?? undefined}
                longitude={beach.lon ?? undefined}
                showForecastPreview={false}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

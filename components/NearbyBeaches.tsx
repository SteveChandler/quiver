"use client";

import { useMemo } from "react";
import { BeachCard } from "@/components/beach-card";
import { useNearbyBeaches } from "@/hooks/useNearbyBeaches";
import { useSelectedBeach } from "@/state/selectedBeach";
import { formatMiles, milesBetween } from "@/lib/utils/distance-utils";

interface NearbyBeachesProps {
  limit?: number;
}

export function NearbyBeaches({ limit = 4 }: NearbyBeachesProps) {
  const { selectedBeach } = useSelectedBeach();
  const lat = selectedBeach?.lat ?? selectedBeach?.latitude ?? undefined;
  const lon = selectedBeach?.lon ?? selectedBeach?.longitude ?? undefined;

  const { data: beaches, loading: isLoading } = useNearbyBeaches(lat, lon, limit);

  const origin = useMemo(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return { lat: lat as number, lon: lon as number };
  }, [lat, lon]);

  const otherBeaches = useMemo(() => {
    if (!selectedBeach) return [];

    return (beaches ?? [])
      .filter((b) => b.id !== selectedBeach.id)
      .slice(0, limit)
      .map((beach) => {
        const destinationLat = beach.lat ?? undefined;
        const destinationLon = beach.lon ?? undefined;

        const hasDestinationCoords =
          Number.isFinite(destinationLat) && Number.isFinite(destinationLon);

        const destination = hasDestinationCoords
          ? { lat: destinationLat as number, lon: destinationLon as number }
          : null;
        const distanceMiles =
          origin && destination ? milesBetween(origin, destination) : null;

        if (process.env.NODE_ENV !== "production") {
          console.debug("[NearbyBeaches] computed distance", {
            selectedBeachId: selectedBeach.id,
            targetBeachId: beach.id,
            origin,
            destination: hasDestinationCoords
              ? {
                  lat: destinationLat,
                  lon: destinationLon,
                }
              : null,
            distanceMiles,
          });
        }

        const distanceLabel =
          typeof distanceMiles === "number" && distanceMiles >= 0
            ? formatMiles(distanceMiles)
            : undefined;

        return {
          ...beach,
          distanceLabel,
        };
      });
  }, [beaches, limit, origin, selectedBeach]);

  if (!selectedBeach) return null;

  const headerLabel = `${Math.min(
    limit,
    Math.max(0, otherBeaches.length)
  )} closest nearby beaches`;

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{headerLabel}</h3>
      </header>

      {isLoading ? (
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {otherBeaches.map((beach) => (
            <BeachCard
              key={beach.id}
              id={beach.id}
              name={beach.name}
              distance={beach.distanceLabel}
              rating={
                typeof beach.rating === "number" ? beach.rating : Number.NaN
              }
              reviewCount={beach.reviewCount ?? 0}
              imageUrl={beach.imageUrl ?? "/images/beach-placeholder.jpg"}
              latitude={beach.lat ?? undefined}
              longitude={beach.lon ?? undefined}
              showForecastPreview={false}
              slug={beach.slug ?? undefined}
              city={beach.city ?? undefined}
              state={beach.state ?? undefined}
              country={beach.country}
            />
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LocationPermissionBanner } from "@/components/ui/location-permission-banner";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useGeolocation } from "@/hooks/use-geolocation";
import { cn } from "@/lib/utils";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";

// NearbyBeach uses lat/lon from the API response, mapped from Beach table fields
interface NearbyBeach {
  id: string;
  name: string;
  latitude: number; // Mapped from lat in API response
  longitude: number; // Mapped from lon in API response
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface NearbyBeachChipsProps {
  className?: string;
  limit?: number;
  onSelect?: (beach: NearbyBeach) => void; // Optional - component handles navigation by default
}

export function NearbyBeachChips({
  className,
  limit = 5,
  onSelect,
}: NearbyBeachChipsProps) {
  const router = useRouter();
  // Never auto-prompt on home; only request on explicit CTA click.
  const {
    coords,
    loading: geoLoading,
    error: geoError,
    errorType,
    requestLocation,
    setLastBeach,
  } = useGeolocation({ autoRequest: false });

  const fetchNearby = useCallback(async (): Promise<NearbyBeach[] | null> => {
    if (!coords?.lat || !coords?.lon) return null;
    const url = new URL("/api/beaches/nearby", window.location.origin); // eslint-disable-line no-restricted-properties
    url.searchParams.set("latitude", String(coords.lat));
    url.searchParams.set("longitude", String(coords.lon));
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Failed nearby fetch: ${res.status}`);
    const json = await res.json();
    const data = (json?.data || json) as Array<any>;
    // Normalize in case endpoint wraps differently
    return (Array.isArray(data) ? data : json?.data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      latitude: b.lat,
      longitude: b.lon,
      slug: b.slug,
      city: b.city,
      state: b.state,
      country: b.country,
    }));
  }, [coords?.lat, coords?.lon, limit]);

  const {
    data: beaches,
    loading,
    error,
    refetch,
  } = useDataFetcher(fetchNearby, {
    skip: !coords?.lat || !coords?.lon,
    initialData: [] as NearbyBeach[],
  });

  const hasCoords = !!coords;
  const showCTA = !hasCoords;

  const handleUseLocation = useCallback(() => {
    requestLocation();
  }, [requestLocation]);

  const handleSelect = useCallback(
    (b: NearbyBeach) => {
      // Save to last beach for geolocation context
      try {
        if (b?.latitude && b?.longitude) {
          setLastBeach({
            id: b.id,
            name: b.name,
            lat: b.latitude,
            lon: b.longitude,
          });
        }
      } catch {}

      // Call optional onSelect callback if provided
      if (onSelect) {
        onSelect(b);
      }

      // Navigate to beach detail page
      const beachUrl = getBeachHrefSafe({
        id: b.id,
        slug: b.slug,
        city: b.city,
        state: b.state,
        country: b.country,
      });

      if (beachUrl) {
        router.push(beachUrl);
      }
    },
    [onSelect, setLastBeach, router]
  );

  if (showCTA) {
    return (
      <div className={cn("space-y-2", className)}>
        {errorType && (
          <LocationPermissionBanner
            errorType={errorType}
            onRetry={handleUseLocation}
          />
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">See nearby spots</p>
          <Button size="sm" onClick={handleUseLocation} disabled={geoLoading}>
            {geoLoading ? "Detecting…" : "Use my location"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Nearest beaches</p>
        {loading && (
          <span className="text-xs text-muted-foreground">Loading…</span>
        )}
      </div>
      {error ? (
        <div className="text-xs text-red-600">
          Failed to load nearby beaches
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2">
          {(beaches || []).slice(0, limit).map((b) => (
            <button
              key={b.id}
              onClick={() => handleSelect(b)}
              className="shrink-0 rounded-full border px-3 py-1 text-sm bg-white hover:bg-gray-50 active:bg-gray-100 focus-ring"
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";
import type { MapBeach } from "@/lib/utils/map-client-props";

// Dynamically import LocationMap with no SSR since it uses Mapbox (client-only)
const LocationMap = dynamic(
  () =>
    import("@/components/location/location-map").then((mod) => mod.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

interface LocationMapClientProps {
  beaches: MapBeach[];
  city: string;
  state: string;
}

export function LocationMapClient({
  beaches,
  city,
  state,
}: LocationMapClientProps) {
  // Location RPC rows never carried every Beach column. Don't fill defaults:
  // the map trusts any timezone it is given (see beach-state-actions).
  return <LocationMap beaches={beaches as Beach[]} city={city} state={state} />;
}

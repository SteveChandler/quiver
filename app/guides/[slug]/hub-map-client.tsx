"use client";

import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";

// Dynamic import for HubMapView (client component with Mapbox)
const HubMapView = dynamic(
  () =>
    import("@/components/hub/hub-map-view").then((mod) => ({
      default: mod.HubMapView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600 mx-auto" />
          <p className="text-sm text-slate-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

interface HubMapClientProps {
  beaches: Beach[];
  centerLatitude: number;
  centerLongitude: number;
  zoom: number;
}

export function HubMapClient({
  beaches,
  centerLatitude,
  centerLongitude,
  zoom,
}: HubMapClientProps) {
  return (
    <HubMapView
      beaches={beaches}
      centerLatitude={centerLatitude}
      centerLongitude={centerLongitude}
      zoom={zoom}
    />
  );
}

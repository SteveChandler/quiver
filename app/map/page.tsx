import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { MapPageClient } from "./map-page-client";

// Loading skeleton for map
function MapSkeleton() {
  return (
    <div
      className="flex-1 relative bg-gray-100 animate-pulse"
      data-testid="map-container"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 font-medium">
            Loading Interactive Map...
          </p>
          <p className="text-sm text-gray-500">Finding nearby surf spots</p>
        </div>
      </div>
      {/* Map header placeholder */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-sm border-b animate-pulse">
        <div className="h-full px-4 flex items-center space-x-4">
          <div className="h-8 w-32 bg-gray-200 rounded"></div>
          <div className="h-8 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] overflow-hidden">
      <h1 className="sr-only">Interactive Surf Spots Map</h1>
      <Suspense fallback={<MapSkeleton />}>
        <MapPageClient />
      </Suspense>
    </div>
  );
}

export async function generateMetadata(
  props: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  // Important: Keep `/map` indexable, but prevent indexing of parameterized
  // variants like `/map?search=Capitola` or `/map?city=san-diego`
  // (canonicalize to `/map`).
  const base = buildPageMetadata({
    title: "Interactive Surf Map — Real-Time Conditions & Forecasts",
    description:
      "Explore surf spots on an interactive map with real-time conditions, break types, and crowd levels. Filter by skill level, wave type, and distance from you.",
    path: "/map",
  });

  const hasAnyQueryParam = (() => {
    if (!searchParams) return false;
    return Object.values(searchParams).some((value) => {
      if (typeof value === "string") return value.length > 0;
      if (Array.isArray(value)) return value.some((v) => typeof v === "string" && v.length > 0);
      return false;
    });
  })();

  if (!hasAnyQueryParam) return base;

  return {
    ...base,
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}

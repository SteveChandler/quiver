import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { MapFirstPaintShell } from "./map-first-paint-shell";
import { MapPageClient } from "./map-page-client";

export default function MapPage() {
  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] overflow-hidden">
      <h1 className="sr-only">Interactive Surf Spots Map</h1>
      <Suspense fallback={<MapFirstPaintShell />}>
        <MapPageClient />
      </Suspense>
    </div>
  );
}

export async function generateMetadata(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
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
      if (Array.isArray(value))
        return value.some((v) => typeof v === "string" && v.length > 0);
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

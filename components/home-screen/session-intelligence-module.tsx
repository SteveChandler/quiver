"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MapImage } from "@/components/map-image";
import { BestSurfWindows } from "@/components/session-intelligence";
import { getStaticMapImageUrlWithPins } from "@/lib/map-utils";
import { buildHomepageSurfWindowRecommendations } from "@/lib/recommendations/session-intelligence-surface-adapters";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

export interface SessionIntelligenceModuleProps {
  recommendations: SurfDiscoveryRecommendation[];
  baseUrl?: string;
}

export function SessionIntelligenceModule({
  recommendations,
  baseUrl,
}: SessionIntelligenceModuleProps) {
  const surfWindows = buildHomepageSurfWindowRecommendations({
    recommendations,
    baseUrl,
  });

  // Regional overview map: numbered rank pins for every window with coords.
  // Hidden entirely (no placeholder) below 2 pins or without a Mapbox token.
  const rankPins = surfWindows
    .filter((window) => window.beach.lat != null && window.beach.lon != null)
    .map((window) => ({
      latitude: window.beach.lat as number,
      longitude: window.beach.lon as number,
      label: String(window.rank),
    }));
  const overviewMapUrl =
    rankPins.length >= 2
      ? getStaticMapImageUrlWithPins(rankPins, {
          width: 1024,
          height: 288,
          style: "mapbox/satellite-streets-v12",
        })
      : null;

  return (
    <section
      data-testid="home-session-intelligence-module"
      aria-labelledby="home-session-intelligence-heading"
      className="overflow-hidden rounded-2xl border border-[#404C92] bg-[#252D6B] p-4 text-white shadow-[0_10px_28px_rgba(13,16,32,0.18)] sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="home-session-intelligence-heading"
            className="font-[var(--font-heading)] text-xl font-bold text-white"
          >
            Find your next best surf window
          </h2>
          <p className="text-sm text-white/65">
            Ranked from your current discovery feed.
          </p>
        </div>
        <Link
          href="/forecast"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#F78E42]/35 bg-[#F78E42]/15 px-4 text-sm font-semibold text-[#FFD2B7] transition hover:bg-[#F78E42]/22"
        >
          Browse best surf windows
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {overviewMapUrl ? (
        <div className="relative mb-4 h-40 overflow-hidden rounded-xl border border-white/10 sm:h-48">
          <MapImage
            src={overviewMapUrl}
            alt="Map of your top surf windows"
            fill
          />
        </div>
      ) : null}

      {surfWindows.length > 0 ? (
        <BestSurfWindows
          recommendations={surfWindows}
          hideHeader
          surface="homepage"
        />
      ) : (
        <div
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-white/68"
          role="status"
        >
          No best-window picks are ready yet. Browse the regional forecast while
          discovery warms up.
        </div>
      )}
    </section>
  );
}

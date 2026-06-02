"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BestSurfWindows } from "@/components/session-intelligence";
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

      {surfWindows.length > 0 ? (
        <BestSurfWindows
          recommendations={surfWindows}
          title="Best windows from your feed"
          subtitle="Open the app link when you want the exact spot and time window."
          ctaLabel="Open in app"
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

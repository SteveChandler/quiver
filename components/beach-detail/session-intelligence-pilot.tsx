"use client";

import { useMemo } from "react";

import { BestSurfWindows } from "@/components/session-intelligence";
import { canRenderBestSurfWindowsForSurface } from "@/lib/recommendations/session-intelligence-rollout";
import { buildSpotSurfWindowRecommendations } from "@/lib/recommendations/session-intelligence-surface-adapters";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface SessionIntelligencePilotProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  beachTimezone?: string | null;
  now?: Date;
  baseUrl?: string;
  canonicalPath?: string;
  recommendationAvailability?: RecommendationAvailability;
}

export function SessionIntelligencePilot({
  beach,
  forecasts,
  beachTimezone,
  now,
  baseUrl,
  canonicalPath,
  recommendationAvailability,
}: SessionIntelligencePilotProps) {
  const effectiveCanonicalPath = canonicalPath ?? buildBeachUrl(beach);
  const canRenderSpotWindows = canRenderBestSurfWindowsForSurface(
    "spot",
    effectiveCanonicalPath
  );
  const recommendations = useMemo(() => {
    if (recommendationAvailability?.state === "none") return [];
    if (!canRenderSpotWindows) return [];
    if (forecasts.length === 0) return [];
    return buildSpotSurfWindowRecommendations({
      beach,
      forecasts,
      now,
      baseUrl,
    });
  }, [
    beach,
    forecasts,
    now,
    baseUrl,
    canRenderSpotWindows,
    recommendationAvailability,
  ]);

  if (recommendations.length === 0) return null;

  const regionLabel = beach.region || beach.city || "this spot";
  const timezoneCopy = beachTimezone ? ` Times shown in ${beachTimezone}.` : "";

  return (
    <section
      data-testid="session-intelligence-pilot"
      className="mx-auto mb-6 max-w-5xl overflow-hidden rounded-2xl border border-[#404C92] bg-[#252D6B] p-4 shadow-[0_10px_28px_rgba(13,16,32,0.26)] sm:p-5"
      aria-label={`Best surf windows at ${beach.name}`}
    >
      {/* BestSurfWindows owns the app CTA anchor and WhyThisCall disclosure. */}
      <BestSurfWindows
        recommendations={recommendations}
        title={`Best surf windows at ${beach.name}`}
        subtitle={`Top upcoming calls for ${regionLabel}, powered by the forecast already loaded on this page.${timezoneCopy}`}
        surface="spot_page"
      />
    </section>
  );
}

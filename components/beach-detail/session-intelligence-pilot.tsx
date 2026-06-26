"use client";

import { useMemo } from "react";

import { BestSurfWindows } from "@/components/session-intelligence";
import { canRenderBestSurfWindowsForSurface } from "@/lib/recommendations/session-intelligence-rollout";
import { buildSpotSurfWindowRecommendations } from "@/lib/recommendations/session-intelligence-surface-adapters";
import { HOW_THE_CALL_WORKS_FACTORS } from "@/lib/surf/how-the-call-works";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface SessionIntelligencePilotProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  beachTimezone?: string | null;
  now?: Date;
  baseUrl?: string;
  canonicalPath?: string;
}

export function SessionIntelligencePilot({
  beach,
  forecasts,
  beachTimezone,
  now,
  baseUrl,
  canonicalPath,
}: SessionIntelligencePilotProps) {
  const effectiveCanonicalPath = canonicalPath ?? buildBeachUrl(beach);
  const canRenderSpotWindows = canRenderBestSurfWindowsForSurface(
    "spot",
    effectiveCanonicalPath
  );
  const recommendations = useMemo(() => {
    if (!canRenderSpotWindows) return [];
    if (forecasts.length === 0) return [];
    return buildSpotSurfWindowRecommendations({
      beach,
      forecasts,
      now,
      baseUrl,
    });
  }, [beach, forecasts, now, baseUrl, canRenderSpotWindows]);

  const regionLabel = beach.region || beach.city || "this spot";
  const timezoneCopy = beachTimezone ? ` Times shown in ${beachTimezone}.` : "";

  if (recommendations.length === 0) {
    return (
      <section
        data-testid="session-intelligence-pilot"
        className="mx-auto mb-6 max-w-5xl overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-4 text-[#11100D] shadow-[4px_4px_0_#11100D] sm:p-5"
        aria-label={`How we make this call at ${beach.name}`}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-[#0B3A75]">
              Read the call
            </p>
            <h2 className="font-heading text-2xl font-black leading-none text-[#11100D] sm:text-3xl">
              How we make this call
            </h2>
            <p className="max-w-3xl font-mono text-sm leading-6 text-[#11100D]/78">
              Use this forecast like a field guide. Read the cues, then decide
              whether this spot deserves a YES, MAYBE, or NO.
            </p>
          </div>

          <ol
            data-testid="session-intelligence-empty-state"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {HOW_THE_CALL_WORKS_FACTORS.map((factor, index) => (
              <li
                key={factor.id}
                className="grid min-h-[118px] grid-cols-[auto_minmax(0,1fr)] gap-3 border-2 border-[#11100D] bg-[#F5EEDC] p-3 shadow-[2px_3px_0_rgba(17,16,13,0.16)]"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center border-2 border-[#11100D] bg-[#11100D] font-heading text-sm font-black text-[#F5EEDC]"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-black uppercase leading-tight text-[#11100D]">
                    {factor.explainerLabel}
                  </h3>
                  <p className="mt-1 font-mono text-xs leading-5 text-[#11100D]/76">
                    {factor.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

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

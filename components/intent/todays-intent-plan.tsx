"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { Clock, Wind } from "lucide-react";
import type { IntentForecastSummary } from "@/actions/forecast/intent-forecast-actions";
import type { SurfIntentSlug } from "@/lib/constants/surf-intents";
import type { SeoScene } from "@/lib/constants/seo-scenes";
import { cityToSlug } from "@/lib/utils/beach-url-utils";
import { SeoScenePanel } from "@/components/seo/seo-scene-panel";
import { SessionIntelligenceIntentHandoff } from "@/components/intent/session-intelligence-intent-handoff";

interface TodaysIntentPlanProps {
  /** Forecast summary data */
  summary: IntentForecastSummary | null;
  /** Intent slug for display customization */
  intentSlug: SurfIntentSlug;
  /** City name for header */
  cityName: string;
  /** State slug for beach links */
  stateSlug: string;
  /** City slug for beach links */
  citySlug: string;
  /** Fallback focus points if no forecast data */
  focusPoints: string[];
  /** Optional location visual for richer SEO pages */
  scene?: SeoScene | null;
}

const INTENT_LABELS: Record<string, string> = {
  longboard: "longboard",
  "least-crowded": "low-crowd",
  "dawn-patrol": "dawn patrol",
  sunset: "sunset",
  "water-temp": "water temp",
};

/**
 * TodaysIntentPlan - Client component rendering the "Today's Plan" module.
 *
 * When forecast summary data is available, shows the best surf window,
 * ranked top beach picks with wave/wind info, and focus tag chips.
 * Falls back to static focus point pills when no summary data exists.
 */
export function TodaysIntentPlan({
  summary,
  intentSlug,
  cityName,
  stateSlug,
  citySlug,
  focusPoints,
  scene,
}: TodaysIntentPlanProps): ReactElement {
  if (!summary) {
    return (
      <>
        <section>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] md:items-stretch">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                What to focus on today
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {focusPoints.map((point) => (
                  <li
                    key={point}
                    className="rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 p-4 text-sm text-gray-700 shadow-sm"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            {scene && (
              <SeoScenePanel
                scene={scene}
                mediaClassName="min-h-[240px] md:h-full md:min-h-full"
              />
            )}
          </div>
        </section>
        <SessionIntelligenceIntentHandoff
          cityName={cityName}
          citySlug={citySlug}
          stateSlug={stateSlug}
        />
      </>
    );
  }

  const intentLabel = INTENT_LABELS[intentSlug] ?? intentSlug;
  const dayLabel = summary.isTomorrow ? "Tomorrow" : "Today";

  return (
    <>
      <section id="todays-plan">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          {dayLabel}&apos;s {intentLabel} plan in {cityName}
        </h2>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] md:items-stretch">
          <div className="rounded-2xl border border-blue-200/50 bg-gradient-to-br from-white/95 to-blue-50/30 shadow-sm overflow-hidden">
            {intentSlug !== "water-temp" && summary.bestWindow && (
              <div className="bg-gradient-to-r from-ocean-blue/10 to-blue-100/30 px-5 py-4 border-b border-blue-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-ocean-blue" />
                  <span className="text-sm font-medium text-gray-600">
                    Best window
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {summary.bestWindow.start}&ndash;{summary.bestWindow.end}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {summary.bestWindow.reason}
                </p>
              </div>
            )}

            {/* Top Picks */}
            {summary.topPicks.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-gray-600 mb-3">Top picks</p>
                <div className="space-y-2.5">
                  {summary.topPicks.map((pick, i) => (
                    <Link
                      key={pick.slug}
                      href={`/${stateSlug}/${cityToSlug(cityName) || citySlug}/${pick.slug}`}
                      className="flex items-center justify-between rounded-lg hover:bg-blue-50/50 transition-colors px-2 py-1.5 -mx-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-ocean-blue/10 text-ocean-blue text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-800">
                          {pick.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium">{pick.waveHeight}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                          <Wind className="h-3 w-3" />
                          {pick.windDirection}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Focus Point Chips */}
            <div className="px-5 py-3 border-t border-blue-100/30 bg-blue-50/20">
              <div className="flex flex-wrap gap-2">
                {focusPoints.map((point) => (
                  <span
                    key={point}
                    className="inline-flex items-center rounded-full bg-white/80 border border-blue-200/40 px-3 py-1 text-xs text-gray-600"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {scene && (
            <SeoScenePanel
              scene={scene}
              mediaClassName="min-h-[260px] md:h-full md:min-h-full"
            />
          )}
        </div>
      </section>

      <SessionIntelligenceIntentHandoff
        cityName={cityName}
        citySlug={citySlug}
        stateSlug={stateSlug}
      />
    </>
  );
}

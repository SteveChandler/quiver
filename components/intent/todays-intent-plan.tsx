"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Wind, Lock } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { track } from "@/lib/analytics";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import { trackSignupCtaClick } from "@/lib/analytics/signup-conversion-tracking";
import type { IntentForecastSummary } from "@/actions/forecast/intent-forecast-actions";
import type { SurfIntentSlug } from "@/lib/constants/surf-intents";

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
 * Auth-gated: logged-out users see the structure but best-window times are
 * locked and blurred. Clicking the lock prompt opens the unified auth modal.
 * After login the component auto-scrolls back to this section if the
 * sessionStorage flag "scroll-to-plan" is present.
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
}: TodaysIntentPlanProps) {
  const { user } = useAuth();
  const isUnlocked = !!user;
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pathname = usePathname();

  // Auto-scroll to this section after the user authenticates
  useEffect(() => {
    if (isUnlocked && typeof window !== "undefined") {
      const shouldScroll = sessionStorage.getItem("scroll-to-plan");
      if (shouldScroll) {
        sessionStorage.removeItem("scroll-to-plan");
        const el = document.getElementById("todays-plan");
        if (el) {
          setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
        }
      }
    }
  }, [isUnlocked]);

  const handleUnlockClick = () => {
    sessionStorage.setItem("scroll-to-plan", "1");
    // GA4-only: not a Supabase funnel event.
    track("plan_unlock_click", { intent: intentSlug });
    trackSignupCtaClick({
      source: `plan-unlock-${intentSlug}`,
      surface: "intent-page",
      intent: intentSlug,
    });
    trackAuthModalOpened({ mode: "signup", source: `plan-unlock-${intentSlug}` });
    setAuthModalOpen(true);
  };

  if (!summary) {
    return (
      <section>
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
      </section>
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

        <div className="rounded-2xl border border-blue-200/50 bg-gradient-to-br from-white/95 to-blue-50/30 shadow-sm overflow-hidden">
          {/* Best Window (skip for water-temp intent) */}
          {intentSlug !== "water-temp" && summary.bestWindow && (
            isUnlocked ? (
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
            ) : (
              <div
                className="bg-gradient-to-r from-ocean-blue/10 to-blue-100/30 px-5 py-4 border-b border-blue-100/50 cursor-pointer"
                onClick={handleUnlockClick}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-ocean-blue" />
                  <span className="text-sm font-medium text-gray-600">Best window</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <p className="text-lg font-semibold text-gray-400 blur-[6px] select-none" aria-hidden="true">
                    8:10 AM–10:45 AM
                  </p>
                </div>
                <p className="text-sm text-ocean-blue mt-1 font-medium">
                  Sign in to reveal exact windows
                </p>
              </div>
            )
          )}

          {/* Top Picks */}
          {summary.topPicks.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-gray-600 mb-3">Top picks</p>
              <div className="space-y-2.5">
                {summary.topPicks.map((pick, i) => (
                  <Link
                    key={pick.slug}
                    href={`/${stateSlug}/${citySlug}/${pick.slug}`}
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
                      {!isUnlocked && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 ml-2">
                          <Lock className="h-3 w-3" />
                          <span className="blur-[4px] select-none" aria-hidden="true">9am</span>
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Lock callout bar — logged-out only */}
          {!isUnlocked && (
            <button
              onClick={handleUnlockClick}
              className="w-full px-5 py-3 bg-ocean-blue/5 border-t border-b border-blue-100/50 flex items-center justify-center gap-2 text-sm font-medium text-ocean-blue hover:bg-ocean-blue/10 transition-colors"
            >
              <Lock className="h-4 w-4" />
              Sign in to reveal exact windows
            </button>
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
      </section>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={`plan-unlock-${intentSlug}`}
        returnTo={pathname ?? undefined}
        contextMessage={{
          title: `Unlock your best ${intentLabel} windows`,
          description: "Free account. Takes ~10 seconds.",
        }}
      />
    </>
  );
}

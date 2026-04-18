"use client";

import { useState, useMemo, useCallback } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";
import dynamic from "next/dynamic";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Waves,
  Wind,
  Sun,
  Globe2,
} from "lucide-react";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BestSurfWindow } from "@/components/beach-detail/best-surf-window";
import { useConditionIntelligence } from "@/hooks/use-condition-intelligence";
import { slugify } from "@/lib/utils/text-utils";
import { formatTimeInBeachTimezone } from "@/lib/utils/date-time";
import { resolveBeachTimezone, getLocalDateString } from "@/lib/utils/timezone-utils";
import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";
import { useDynamicTide } from "@/hooks/use-dynamic-tide";
import { useSunTimes } from "@/hooks/use-sun-times";
import { TideConditionsCard } from "@/components/beach-detail/tide-conditions-card";
import type { YesterdayAccuracy } from "@/types/accuracy";
import { YesterdaysAccuracyCard } from "@/components/beach-detail/yesterdays-accuracy-card";
import { TideAlertBadge } from "@/components/beach-detail/tide-alert";
import { getTideAlert } from "@/lib/surf/tide-direction";
import { HorizonStrip } from "@/components/forecast/horizon-strip";
import { aggregateDayForecasts } from "@/lib/utils/horizon-strip-utils";
import { formatTideHeight } from "@/lib/formatters/surf-data";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import { EmbedCodeButton } from "@/components/beach-detail/embed-code-modal";
import { DataErrorBoundary } from "@/components/error-boundaries";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
// PersonalizedForecastTeaser and useAuth removed — Phase 1A CTA reduction.
import { TideStatusStrip } from "@/components/beach-detail/tide-status-strip";
import { TideChartSection } from "@/components/beach-detail/tide-chart-section";
import { TextureOverlay } from "@/components/ui/texture-overlay";

const ConditionsOverview = dynamic(
  () =>
    import("@/components/forecast/conditions-overview/conditions-overview").then(
      (m) => ({ default: m.ConditionsOverview })
    ),
  { ssr: false }
);

interface ForecastTabProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  currentForecast: EnhancedForecastEntity | null;
  beachTimezone?: string | null;
  surfCall?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;
  defaultSubTab?: "today" | "tides" | "conditions";
  publicMode?: boolean;
  yesterdayAccuracy?: YesterdayAccuracy | null;
}

export function ForecastTab({
  beach,
  forecasts,
  currentForecast,
  beachTimezone,
  surfCall,
  surfCallIsTomorrow,
  defaultSubTab,
  publicMode = false,
  yesterdayAccuracy,
}: ForecastTabProps) {


  const { track: trackEvent } = useTrackEvent();
  const [activeSubTab, setActiveSubTab] = useState<
    "today" | "tides" | "conditions"
  >(defaultSubTab || "today");

  // Horizon Strip: selected date for filtering (defaults to today)
  const [horizonSelectedDate, setHorizonSelectedDate] = useState<string>(() => {
    return getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone));
  });

  const handleHorizonDaySelect = useCallback((date: string) => {
    trackEvent('forecast_interaction', {
      beachId: beach.id,
      metadata: { action: 'change_slot', slot: date },
      debounceMs: 1000,
    });
    setHorizonSelectedDate(date);
    setActiveSubTab("conditions");
  }, [beach.id, trackEvent]); // State setters are stable refs

  // Horizon Strip: aggregated day summaries (12 days)
  const horizonDaySummaries = useMemo(() => {
    return aggregateDayForecasts(forecasts, beach, {
      maxDays: 12,
      timezone: beachTimezone || undefined,
    });
  }, [forecasts, beach, beachTimezone]);

  // Public mode: the first 3 days are the free window shown to anonymous
  // users. The horizon strip now renders ALL 12 days (with days 4-12 blurred
  // as a loss-aversion signal), but the conditions tab still only receives
  // the free window so no forecast detail leaks. See Change 3 in
  // plans/abstract-exploring-phoenix.md.
  const PUBLIC_FREE_DAYS = 3;
  const publicHorizonDays = publicMode
    ? horizonDaySummaries.slice(0, PUBLIC_FREE_DAYS)
    : horizonDaySummaries;

  // Gated-horizon state — opens auth modal when an anonymous user taps a
  // blurred day card (days 4-12 in public mode). Uses the same UnifiedAuthModal
  // as other beach-page signup surfaces.
  const [gatedAuthOpen, setGatedAuthOpen] = useState(false);

  // Forecasts filtered by horizon strip selection
  const selectedDateForecasts = useMemo(() => {
    if (!horizonSelectedDate) return forecasts;
    const tz = resolveBeachTimezone(beachTimezone);
    return forecasts.filter((f) => extractForecastDate(f.forecast_at, tz) === horizonSelectedDate);
  }, [forecasts, horizonSelectedDate, beachTimezone]);

  // Public mode: allowed dates (first 3 days)
  const publicAllowedDates = useMemo(() => {
    if (!publicMode) return null;
    const tz = resolveBeachTimezone(beachTimezone);
    const today = getLocalDateString(new Date(), tz);
    const futureDates = [...new Set(forecasts.map(f => extractForecastDate(f.forecast_at, tz)).filter(d => d >= today))].sort();
    return new Set(futureDates.slice(0, 3));
  }, [publicMode, forecasts, beachTimezone]);

  // Public mode: filter forecasts to 3 days (reuses publicAllowedDates)
  const publicFilteredForecasts = useMemo(() => {
    if (!publicMode || !publicAllowedDates) return forecasts;
    const tz = resolveBeachTimezone(beachTimezone);
    return forecasts.filter(f => publicAllowedDates.has(extractForecastDate(f.forecast_at, tz)));
  }, [publicMode, forecasts, publicAllowedDates, beachTimezone]);

  const todayStr = useMemo(() => {
    return getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone));
  }, [beachTimezone]);

  const todaysForecasts = useMemo(
    () => {
      const tz = resolveBeachTimezone(beachTimezone);
      return forecasts.filter((f) => extractForecastDate(f.forecast_at, tz) === todayStr);
    },
    [forecasts, todayStr, beachTimezone]
  );

  // Condition Intelligence: scored windows, board pick, relative context
  // Passing full forecasts so the hook can group by date and compute weekly context
  const conditionIntel = useConditionIntelligence(forecasts, beach, beachTimezone);

  // Dynamic tide computation (always fresh, relative to now)
  const dynamicTide = useDynamicTide(forecasts, beachTimezone);

  // Fetch sunrise/sunset times for today
  const { sunrise, sunset } = useSunTimes(beach.id, todayStr);

  // Format sun time for display
  const formatSunTime = (date: Date | null) => {
    if (!date) return "—";
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Tide alert based on direction match
  const tideAlert = useMemo(() => {
    // Fall back to forecast tide_status when dynamic tide hasn't computed yet
    let effectiveDirection = dynamicTide.currentDirection;
    if (!effectiveDirection && currentForecast?.tide_status) {
      const status = currentForecast.tide_status.toLowerCase();
      if (status.includes("rising")) effectiveDirection = "rising";
      else if (status.includes("falling")) effectiveDirection = "falling";
    }
    return getTideAlert(
      beach.preferred_tide_direction,
      effectiveDirection,
      dynamicTide.minutesToDirectionChange
    );
  }, [
    beach.preferred_tide_direction,
    dynamicTide.currentDirection,
    dynamicTide.minutesToDirectionChange,
    currentForecast?.tide_status,
  ]);

  const formatMetric = (
    value: string | number | null | undefined,
    decimals = 1,
    fallback = "—"
  ) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toFixed(decimals);
    }
    if (typeof value === "string") {
      const numeric = parseFloat(value);
      if (!Number.isNaN(numeric)) {
        return numeric.toFixed(decimals);
      }
      return value;
    }
    return fallback;
  };

  /**
   * Format a time string with timezone awareness when possible.
   * If nextTideAt (ISO timestamp) is available, uses beach coordinates
   * for proper local timezone display.
   */
  const formatTimeString = (time?: string | null, nextTideAt?: string | null) => {
    // Prefer timezone-aware formatting using ISO timestamp + beach timezone
    if (nextTideAt && beachTimezone) {
      return formatTimeInBeachTimezone(nextTideAt, beachTimezone);
    }

    // Fallback to original behavior
    if (!time) return "—";
    if (time.includes("T")) {
      try {
        return new Date(time).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        return time;
      }
    }
    return time;
  };

  // Use dynamic tide direction for icon (matches real-time tide state)
  const TideIcon =
    dynamicTide.currentDirection === "rising"
      ? ArrowUp
      : dynamicTide.currentDirection === "falling"
      ? ArrowDown
      : Minus;

  // Get current tide status display text
  const getCurrentTideDisplay = () => {
    switch (dynamicTide.currentDirection) {
      case "rising":
        return "Rising";
      case "falling":
        return "Falling";
      case "slack":
        return "Slack";
      default:
        // Fallback to forecast tide_status if dynamic not available
        const status = (currentForecast?.tide_status || "").toLowerCase();
        if (status.includes("rising")) return "Rising";
        if (status.includes("falling")) return "Falling";
        return "—";
    }
  };

  const heroWaveHeight = formatMetric(currentForecast?.wave_height);

  // Population-level calibration flag: true when this beach has an empirical
  // shoaling calibration (`beaches.shoaling_factors IS NOT NULL`). Used by the
  // honesty layer to switch wave-height displays between "Face height" and
  // "Forecast height". See docs/design/calibration-honesty-spec.md and the
  // matching convention in app/api/forecasts/update-enhanced/route.ts.
  const beachIsCalibrated =
    (beach as Beach & { shoaling_factors?: unknown })?.shoaling_factors != null;

  // Dynamic tide display with fallback to static forecast values
  const heroNextTideType = dynamicTide.nextTide
    ? dynamicTide.nextTide.type === "high"
      ? "High Tide"
      : "Low Tide"
    : currentForecast?.next_tide_type ?? "—";

  const heroNextTideHeight = dynamicTide.nextTide
    ? `${formatTideHeight(dynamicTide.nextTide.height)}`
    : currentForecast?.next_tide_height ?? "";

  // Helper for next tide time display
  const getNextTideTimeDisplay = () => {
    if (dynamicTide.nextTide) {
      const date = new Date(dynamicTide.nextTide.time * 1000);
      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return formatTimeString(currentForecast?.next_tide_time, currentForecast?.next_tide_at);
  };

  const snapshotSwellPeriod = formatMetric(currentForecast?.wave_period);
  const snapshotDirection = currentForecast?.wave_direction ?? "—";
  const snapshotSwellDetails =
    snapshotSwellPeriod === "—"
      ? `— · ${snapshotDirection}`
      : `${snapshotSwellPeriod} s · ${snapshotDirection}`;

  return (
    <DataErrorBoundary dataType="forecast" componentName="ForecastTab">
    <div className="space-y-6 py-6">
      {/* 12-Day Horizon Strip
          Anonymous users see all 12 days; cards beyond PUBLIC_FREE_DAYS are
          rendered blurred with a lock overlay. Clicking a blurred card opens
          the auth modal via onGatedClick — this reuses the existing
          signup-tracking funnel (source: horizon-strip-gated-days) so we can
          measure conversion from the loss-aversion signal without adding a
          banner (which Phase 1A/1B explicitly removed). */}
      {forecasts.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-4 sm:px-6">
            {/* Heading uses the total horizon length regardless of publicMode —
                the blur on days 4-12 is itself the loss-aversion signal; the
                heading doesn't need to repeat it. */}
            <h2 className="text-sm font-medium text-muted-foreground">
              {horizonDaySummaries.length}-Day Outlook
            </h2>
            <span className="text-xs text-muted-foreground">
              Tap a day to view details
            </span>
          </div>
          <HorizonStrip
            days={horizonDaySummaries}
            selectedDate={horizonSelectedDate}
            onSelectDate={handleHorizonDaySelect}
            beachSlug={slugify(beach.name)}
            publicGateFromIndex={publicMode ? PUBLIC_FREE_DAYS : undefined}
            onGatedClick={publicMode ? () => setGatedAuthOpen(true) : undefined}
          />
        </section>
      )}

      {publicMode && (
        <UnifiedAuthModal
          isOpen={gatedAuthOpen}
          onClose={() => setGatedAuthOpen(false)}
          mode="signup"
          source="horizon-strip-gated-days"
          contextMessage={{
            title: `See the full 12-day call for ${beach.name}`,
            description:
              "Free — pick your home beach and we'll score every hour so you know when to paddle out.",
          }}
        />
      )}

      {/* Tabbed Content */}
      <Tabs
        value={activeSubTab}
        onValueChange={(value) => {
          trackEvent('forecast_interaction', {
            beachId: beach.id,
            metadata: { action: 'view_details', slot: value },
            debounceMs: 1000,
          });
          setActiveSubTab(value as typeof activeSubTab);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 gap-2 rounded-full bg-blue-100/60 p-1">
          <TabsTrigger
            value="today"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-ocean-blue data-[state=active]:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue"
          >
            <Sun className="h-4 w-4" />
            <span>Today</span>
          </TabsTrigger>
          <TabsTrigger
            value="tides"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-ocean-blue data-[state=active]:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue"
          >
            <Waves className="h-4 w-4" />
            <span>Tides</span>
          </TabsTrigger>
          <TabsTrigger
            value="conditions"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-ocean-blue data-[state=active]:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue"
          >
            <Globe2 className="h-4 w-4" />
            <span>Conditions</span>
          </TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-6 mt-6">
          {/* Current Forecast Snapshot */}
          {currentForecast && (
            <section className="rounded-2xl border border-white/10 bg-[#141937] p-4 md:p-6 shadow-lg relative overflow-hidden">
              <TextureOverlay variant="topo" />
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-heading font-semibold text-white/90 relative">
                    Current Conditions
                  </h2>
                  <span className="text-sm text-white/60 relative">
                    Right now
                  </span>
                </div>

                {/* Tide Alert */}
                {beach.preferred_tide_direction && (
                  <TideAlertBadge alert={tideAlert} />
                )}

                <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
                  <div className="flex flex-col items-center gap-1 sm:gap-4 rounded-[8px_16px_16px_8px] border-l-[3px] border-l-[#F78E42] bg-[#141937] p-3 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center sm:justify-between relative">
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[rgba(247,142,66,0.1)] border border-[rgba(247,142,66,0.15)] sm:order-last">
                      <TideIcon className="h-5 w-5 sm:h-8 sm:w-8 text-[#F78E42]" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="text-xs uppercase tracking-wider sm:tracking-[0.2em] text-[#FFA559]">
                        Tide
                      </div>
                      <div className="mt-0.5 sm:mt-2 text-base sm:text-2xl font-bold text-white">
                        {getCurrentTideDisplay()}
                      </div>
                      <div className="hidden sm:block text-sm text-white/60">
                        Next: {heroNextTideType} @ {getNextTideTimeDisplay()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 sm:gap-4 rounded-[8px_16px_16px_8px] border-l-[3px] border-l-[#6CB4EE] bg-[#141937] p-3 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center sm:justify-between relative">
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[rgba(108,180,238,0.1)] border border-[rgba(108,180,238,0.15)] sm:order-last">
                      <Wind className="h-5 w-5 sm:h-8 sm:w-8 text-[#6CB4EE]" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="text-xs uppercase tracking-wider sm:tracking-[0.2em] text-[#8DC8F5]">
                        Wind
                      </div>
                      <div className="mt-0.5 sm:mt-2 text-base sm:text-2xl font-bold text-white">
                        {currentForecast?.wind_speed ?? "—"}
                      </div>
                      <div className="text-xs sm:text-sm text-white/60 uppercase">
                        {currentForecast?.wind_direction ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 sm:gap-4 rounded-[8px_16px_16px_8px] border-l-[3px] border-l-[#FDB84B] bg-[#141937] p-3 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center sm:justify-between relative">
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[rgba(253,184,75,0.1)] border border-[rgba(253,184,75,0.15)] sm:order-last">
                      <Waves className="h-5 w-5 sm:h-8 sm:w-8 text-[#FDB84B]" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="text-xs uppercase tracking-wider sm:tracking-[0.2em] text-[#FDCA7B]">
                        Swell
                      </div>
                      <div className="mt-0.5 sm:mt-2 text-base sm:text-2xl font-bold text-white">
                        {heroWaveHeight === "—" ? (
                          "— ft"
                        ) : (
                          <WaveHeightDisplay
                            height={`${heroWaveHeight} ft`}
                            isCalibrated={beachIsCalibrated}
                            showTooltip={true}
                            className="text-base sm:text-2xl font-bold text-white"
                          />
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-white/60">
                        {snapshotSwellDetails}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secondary Conditions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-3 sm:mt-4">
                  {/* Swell Direction */}
                  <div className="rounded-xl bg-white/5 p-2 sm:p-3 border border-white/10 relative">
                    <div className="text-xs text-white/60 mb-1">Swell Direction</div>
                    <div className="text-sm font-semibold text-white">
                      {currentForecast?.swell_1_direction ?? "—"}
                    </div>
                  </div>

                  {/* Water Temp */}
                  <div className="rounded-xl bg-white/5 p-2 sm:p-3 border border-white/10 relative">
                    <div className="text-xs text-white/60 mb-1">Water Temp</div>
                    <div className="text-sm font-semibold text-white">
                      {currentForecast?.water_temp ? `${String(currentForecast.water_temp).replace(/°F$/, "")}°F` : "—"}
                    </div>
                  </div>

                  {/* Next Tide */}
                  <div className="rounded-xl bg-white/5 p-2 sm:p-3 border border-white/10 relative">
                    <div className="text-xs text-white/60 mb-1">Next Tide</div>
                    <div className="text-sm font-semibold text-white">
                      {heroNextTideType} @ {getNextTideTimeDisplay()}
                    </div>
                  </div>

                  {/* Sunrise/Sunset */}
                  <div className="rounded-xl bg-white/5 p-2 sm:p-3 border border-white/10 relative">
                    <div className="text-xs text-white/60 mb-1">Daylight</div>
                    <div className="text-sm font-semibold text-white">
                      {sunrise && sunset
                        ? `${formatSunTime(sunrise)} - ${formatSunTime(sunset)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Yesterday's Accuracy */}
          {yesterdayAccuracy?.should_display && (
            <YesterdaysAccuracyCard accuracy={yesterdayAccuracy} />
          )}

          {/* Best Surf Window */}
          {(() => {
            const bestSurfWindowContent = (
              <BestSurfWindow
                beachId={beach.id}
                beachName={beach.name}
                beachTimezone={beachTimezone}
                forecasts={todaysForecasts}
                surfCall={surfCall}
                surfCallIsTomorrow={surfCallIsTomorrow}
                windows={conditionIntel.windows.map((w) => ({
                  start: w.start.toISOString(),
                  end: w.end.toISOString(),
                  avgScore: w.avgScore ?? 0,
                  character: w.character
                    ? { label: w.character.label, category: w.character.category }
                    : undefined,
                  reasons: [],
                }))}
                boardPick={
                  conditionIntel.boardPick
                    ? {
                        boardName: conditionIntel.boardPick.boardName,
                        boardType: conditionIntel.boardPick.boardType,
                        reason: conditionIntel.boardPick.reason,
                      }
                    : null
                }
                relativeContext={
                  conditionIntel.relativeContext
                    ? {
                        isBestOfWeek: conditionIntel.relativeContext.isBestOfWeek,
                        trend: conditionIntel.relativeContext.trend,
                        incomingSwell:
                          conditionIntel.relativeContext.incomingSwell
                            ? {
                                date: conditionIntel.relativeContext.incomingSwell.date,
                                description:
                                  conditionIntel.relativeContext.incomingSwell.description,
                              }
                            : null,
                      }
                    : undefined
                }
              />
            );

            // Lead with the actual best window as the hook — the value goes
            // on-screen unblurred, then the gate promises what signing up unlocks.
            // Previous copy ("See today's surf call") was generic and buried the
            // real value in the description; 275 views → 0 clicks on 2026-04-09.
            const { ctaTitle: gateTitle, ctaDescription: gateDescription } = (() => {
              if (!surfCall?.bestWindowStart) {
                return {
                  ctaTitle: `Daily surf call for ${beach.name}`,
                  ctaDescription:
                    "We score every hour by tide, wind, and swell. Sign up free to see today's optimal window and tomorrow's call.",
                };
              }
              const d = new Date(surfCall.bestWindowStart);
              const timeStr = isNaN(d.getTime())
                ? surfCall.bestWindowStart
                : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              const waveInfo = surfCall.waveHeight ? ` · ${surfCall.waveHeight}` : "";
              return {
                ctaTitle: `Best window today: ${timeStr}${waveInfo}`,
                ctaDescription:
                  "Sign up free to unlock the full hour-by-hour breakdown, paddle alerts, and the 7-day call.",
              };
            })();

            return publicMode ? (
              <PublicContentGate
                ctaTitle={gateTitle}
                ctaDescription={gateDescription}
                ctaButtonText="Unlock the full breakdown"
                blurLevel="sm"
                source="best-window-gate"
                className="min-h-[200px]"
              >
                {bestSurfWindowContent}
              </PublicContentGate>
            ) : bestSurfWindowContent;
          })()}
        </TabsContent>

        {/* Tides Tab */}
        <TabsContent value="tides" className="space-y-4 mt-6">
          <TideStatusStrip dynamicTide={dynamicTide} />
          <TideChartSection forecasts={forecasts} />
          {beach.preferred_tide_direction && <TideAlertBadge alert={tideAlert} />}
          <TideConditionsCard
            prose={beach.best_conditions_prose}
            preferredDirection={beach.preferred_tide_direction}
          />
          <div className="flex justify-end px-1">
            <EmbedCodeButton beachSlug={beach.slug} beachName={beach.name} />
          </div>
        </TabsContent>

        {/* Conditions Tab */}
        <TabsContent value="conditions" className="mt-6">
          <ConditionsOverview
            horizonDaySummaries={publicMode ? publicHorizonDays : horizonDaySummaries}
            forecasts={publicMode ? publicFilteredForecasts : forecasts}
            beach={beach}
            publicMode={publicMode}
            selectedDate={horizonSelectedDate}
          />
        </TabsContent>
      </Tabs>

    </div>
    </DataErrorBoundary>
  );
}

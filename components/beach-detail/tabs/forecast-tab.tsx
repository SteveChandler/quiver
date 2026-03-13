"use client";

import { useState, useMemo, useCallback } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Waves,
  Wind,
  Sun,
  Globe2,
  CalendarDays,
} from "lucide-react";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BestSurfWindow } from "@/components/beach-detail/best-surf-window";
import { slugify } from "@/lib/utils/text-utils";
import { trackSignupCtaClick } from "@/lib/analytics/signup-conversion-tracking";
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
import { EmbedCodeButton } from "@/components/beach-detail/embed-code-modal";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { DataErrorBoundary } from "@/components/error-boundaries";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { PublicContentGate } from "@/components/ui/public-content-gate";

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
  const { profile } = useCachedProfile();

  const userScoringPrefs = useMemo(() => {
    const validSizes = ['small', 'medium', 'large'] as const;
    if (!profile?.preferred_wave_size || !validSizes.includes(profile.preferred_wave_size as typeof validSizes[number])) return undefined;
    return { preferredWaveSize: profile.preferred_wave_size as 'small' | 'medium' | 'large' };
  }, [profile?.preferred_wave_size]);

  const { track: trackEvent } = useTrackEvent();
  const [activeSubTab, setActiveSubTab] = useState<
    "today" | "tides" | "conditions"
  >(defaultSubTab || "today");
  const [horizonAuthModal, setHorizonAuthModal] = useState(false);

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
      userPreferences: userScoringPrefs,
    });
  }, [forecasts, beach, beachTimezone, userScoringPrefs]);

  // Public mode: limit horizon to 3 days
  const publicHorizonDays = publicMode ? horizonDaySummaries.slice(0, 3) : horizonDaySummaries;

  const firstHiddenDayName = useMemo(() => {
    if (!publicMode || horizonDaySummaries.length <= 3) return null;
    const hiddenDay = horizonDaySummaries[3];
    if (!hiddenDay?.fullDate) return null;
    try {
      return new Date(`${hiddenDay.fullDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });
    } catch {
      return null;
    }
  }, [publicMode, horizonDaySummaries]);

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
    return getTideAlert(
      beach.preferred_tide_direction,
      dynamicTide.currentDirection,
      dynamicTide.minutesToDirectionChange
    );
  }, [
    beach.preferred_tide_direction,
    dynamicTide.currentDirection,
    dynamicTide.minutesToDirectionChange,
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
      {/* 12-Day Horizon Strip */}
      {forecasts.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-4 sm:px-6">
            <h2 className="text-sm font-medium text-muted-foreground">
              {publicHorizonDays.length}-Day Outlook
            </h2>
            <span className="text-xs text-muted-foreground">
              Tap a day to view details
            </span>
          </div>
          <HorizonStrip
            days={publicHorizonDays}
            selectedDate={horizonSelectedDate}
            onSelectDate={handleHorizonDaySelect}
            beachSlug={slugify(beach.name)}
          />
          {publicMode && horizonDaySummaries.length > 3 && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-3 w-full flex items-center gap-3 rounded-xl
                  bg-gradient-to-r from-blue-50/80 to-cyan-50/60
                  border border-ocean-blue/10 p-3 cursor-pointer
                  hover:border-ocean-blue/20 hover:shadow-sm transition-all"
                onClick={() => {
                  trackSignupCtaClick({ source: "horizon-strip-outlook" });
                  trackAuthModalOpened({ mode: "signup", source: "horizon-strip-outlook" });
                  setHorizonAuthModal(true);
                }}
              >
                <CalendarDays className="h-4 w-4 text-ocean-blue flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  Conditions shift on <span className="font-semibold">{firstHiddenDayName ?? "Day 4"}</span>
                </p>
                <span className="ml-auto text-sm font-semibold text-ocean-blue whitespace-nowrap">
                  See outlook →
                </span>
              </motion.button>
              <UnifiedAuthModal
                isOpen={horizonAuthModal}
                onClose={() => setHorizonAuthModal(false)}
                mode="signup"
                source="horizon-strip-outlook"
                contextMessage={{
                  title: "See the Full Outlook",
                  description: "Plan your week with the 12-day forecast",
                }}
              />
            </>
          )}
        </section>
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
            <section className="rounded-3xl border border-blue-100/60 bg-white/95 p-4 md:p-6 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-heading font-semibold text-dark-grey">
                    Current Conditions
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    Right now
                  </span>
                </div>

                {/* Tide Alert */}
                {beach.preferred_tide_direction && (
                  <TideAlertBadge alert={tideAlert} />
                )}

                <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
                  <div className="flex flex-col items-center gap-1 sm:gap-4 rounded-2xl border border-ocean-blue/10 border-l-4 border-l-[#0EA5E9] bg-gradient-to-br from-ocean-blue/5 to-white p-3 sm:p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-ocean-blue/10 sm:order-last">
                      <TideIcon className="h-5 w-5 sm:h-8 sm:w-8 text-sky-500" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-[0.2em] text-sky-500">
                        Tide
                      </div>
                      <div className="mt-0.5 sm:mt-2 text-base sm:text-2xl font-bold text-dark-grey">
                        {getCurrentTideDisplay()}
                      </div>
                      <div className="hidden sm:block text-sm text-muted-foreground">
                        Next: {heroNextTideType} @ {getNextTideTimeDisplay()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 sm:gap-4 rounded-2xl border border-ocean-blue/10 border-l-4 border-l-[#38BDF8] bg-gradient-to-br from-blue-100/40 to-white p-3 sm:p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-ocean-blue/10 sm:order-last">
                      <Wind className="h-5 w-5 sm:h-8 sm:w-8 text-ocean-blue" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-[0.2em] text-ocean-blue">
                        Wind
                      </div>
                      <div className="mt-0.5 sm:mt-2 text-base sm:text-2xl font-bold text-dark-grey">
                        {currentForecast?.wind_speed ?? "—"}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground uppercase">
                        {currentForecast?.wind_direction ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 sm:gap-4 rounded-2xl border border-ocean-blue/10 border-l-4 border-l-[#6366F1] bg-gradient-to-br from-blue-100/30 to-white p-3 sm:p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-ocean-blue/10 sm:order-last">
                      <Waves className="h-5 w-5 sm:h-8 sm:w-8 text-sky-500" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-[0.2em] text-sky-500">
                        Swell
                      </div>
                      <div className="mt-0.5 sm:mt-2 text-base sm:text-2xl font-bold text-dark-grey">
                        {heroWaveHeight} ft
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {snapshotSwellDetails}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secondary Conditions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-3 sm:mt-4">
                  {/* Swell Direction */}
                  <div className="rounded-xl bg-gray-50/80 p-2 sm:p-3 border border-gray-100 border-l-4 border-l-[#6366F1]">
                    <div className="text-xs text-sky-500 font-medium mb-1">Swell Direction</div>
                    <div className="text-sm font-semibold text-dark-grey">
                      {currentForecast?.swell_1_direction ?? "—"}
                    </div>
                  </div>

                  {/* Water Temp */}
                  <div className="rounded-xl bg-gray-50/80 p-2 sm:p-3 border border-gray-100 border-l-4 border-l-[#F59E0B]">
                    <div className="text-xs text-sky-500 font-medium mb-1">Water Temp</div>
                    <div className="text-sm font-semibold text-dark-grey">
                      {currentForecast?.water_temp ? `${String(currentForecast.water_temp).replace(/°F$/, "")}°F` : "—"}
                    </div>
                  </div>

                  {/* Next Tide */}
                  <div className="rounded-xl bg-gray-50/80 p-2 sm:p-3 border border-gray-100 border-l-4 border-l-[#0EA5E9]">
                    <div className="text-xs text-sky-500 font-medium mb-1">Next Tide</div>
                    <div className="text-sm font-semibold text-dark-grey">
                      {heroNextTideType} @ {getNextTideTimeDisplay()}
                    </div>
                  </div>

                  {/* Sunrise/Sunset */}
                  <div className="rounded-xl bg-gray-50/80 p-2 sm:p-3 border border-gray-100">
                    <div className="text-xs text-muted-foreground mb-1">Daylight</div>
                    <div className="text-sm font-semibold text-dark-grey">
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

          {/* Best Surf Window — gated for anonymous users */}
          <PublicContentGate
            ctaTitle={`See today's surf call for ${beach.name}`}
            ctaDescription="Sign up to get personalized surf calls and best time to paddle out"
            source="surf-call-conditions"
          >
            <BestSurfWindow
              beachId={beach.id}
              beachName={beach.name}
              beachTimezone={beachTimezone}
              forecasts={todaysForecasts}
              surfCall={surfCall}
              surfCallIsTomorrow={surfCallIsTomorrow}
            />
          </PublicContentGate>
        </TabsContent>

        {/* Tides Tab */}
        <TabsContent value="tides" className="mt-6">
          <section className="rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg backdrop-blur overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-0 mb-4">
              <h2 className="text-xl font-heading font-semibold text-dark-grey">
                Tide Forecast
              </h2>
              <EmbedCodeButton beachSlug={beach.slug} beachName={beach.name} />
            </div>
            <iframe
              src={`/embed/surf-terminal/${beach.slug}?theme=light&range=3d`}
              width="100%"
              className="border-0 h-[clamp(380px,60vh,600px)]"
              title={`${beach.name} Surf Terminal`}
              loading="lazy"
            />
          </section>

          {/* Tide Conditions Card */}
          <TideConditionsCard
            prose={beach.best_conditions_prose}
            preferredDirection={beach.preferred_tide_direction}
          />
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

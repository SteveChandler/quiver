"use client";

import { useState, useMemo, useCallback } from "react";
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
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BestSurfWindow } from "@/components/beach-detail/best-surf-window";
import { SimplifiedForecastTable } from "@/components/forecast/forecast-table";
import { TideChartEnhanced } from "@/components/forecast/tide-chart-enhanced";
import { generateTideDiagnosticsFromForecasts } from "@/lib/utils/tide-diagnostics-generator";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { formatTimeInBeachTimezone } from "@/lib/utils/date-utils";
import { resolveBeachTimezone, getLocalDateString } from "@/lib/utils/timezone-utils";
import { extractForecastDate, extractLocalHour } from "@/lib/utils/forecast-at-adapter";
import { useDynamicTide } from "@/hooks/use-dynamic-tide";
import { useSunTimes } from "@/hooks/use-sun-times";
import { TideConditionsCard } from "@/components/beach-detail/tide-conditions-card";
import type { YesterdayAccuracy } from "@/types/accuracy";
import { YesterdaysAccuracyCard } from "@/components/beach-detail/yesterdays-accuracy-card";
import { TideAlertBadge } from "@/components/beach-detail/tide-alert";
import { getTideAlert } from "@/lib/surf/tide-direction";
import { HorizonStrip } from "@/components/forecast/horizon-strip";
import { aggregateDayForecasts, formatWaveRange, type DaySummary } from "@/lib/utils/horizon-strip-utils";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import { EmbedCodeButton } from "@/components/beach-detail/embed-code-modal";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { DataErrorBoundary } from "@/components/error-boundaries";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";

const DetailedSwellModal = dynamic(
  () =>
    import("@/components/beach-detail/detailed-swell-modal").then(
      (m) => m.DetailedSwellModal
    ),
  { ssr: false }
);

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedForecastEntry, setSelectedForecastEntry] =
    useState<EnhancedForecastEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<
    "today" | "tides" | "conditions"
  >(defaultSubTab || "today");
  const [horizonAuthModal, setHorizonAuthModal] = useState(false);
  const [outlookAuthModal, setOutlookAuthModal] = useState(false);

  // Horizon Strip: selected date for filtering (defaults to today)
  const [horizonSelectedDate, setHorizonSelectedDate] = useState<string>(() => {
    return getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone));
  });

  const handleHorizonDaySelect = useCallback((date: string) => {
    setHorizonSelectedDate(date);
    setActiveSubTab("conditions");
  }, []); // State setters are stable refs

  const forecastsByDate = useMemo(() => {
    const grouped: Record<string, EnhancedForecastEntity[]> = {};
    const tz = resolveBeachTimezone(beachTimezone);

    if (forecasts && Array.isArray(forecasts) && forecasts.length > 0) {
      forecasts.forEach((forecast) => {
        if (forecast && forecast.forecast_at) {
          const date = extractForecastDate(forecast.forecast_at, tz);
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push(forecast);
        }
      });
    }

    return grouped;
  }, [forecasts, beachTimezone]);

  const sortedDates = useMemo(
    () => Object.keys(forecastsByDate).sort(),
    [forecastsByDate]
  );

  const miniForecastDays = useMemo(() => {
    const today = getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone));
    return sortedDates
      .filter((date) => date >= today)
      .slice(0, 5)
      .map((date) => {
        const dayEntries = forecastsByDate[date] || [];
        if (!dayEntries.length) {
          return null;
        }
        const tz = resolveBeachTimezone(beachTimezone);
        const middayEntry = dayEntries.find((entry) =>
          entry.forecast_at ? extractLocalHour(entry.forecast_at, tz) === 12 : false
        );
        const fallbackEntry =
          dayEntries[Math.floor(dayEntries.length / 2)] || dayEntries[0];
        return {
          date,
          forecast: middayEntry || fallbackEntry,
        };
      })
      .filter(Boolean) as {
      date: string;
      forecast: EnhancedForecastEntity;
    }[];
  }, [sortedDates, forecastsByDate, beachTimezone]);

  // Public mode: visible and hidden days for 5-Day Outlook
  const visibleDays = publicMode ? miniForecastDays.slice(0, 3) : miniForecastDays;
  const hiddenDaysCount = publicMode ? Math.max(0, miniForecastDays.length - 3) : 0;

  // Horizon Strip: aggregated day summaries (12 days)
  const horizonDaySummaries = useMemo(() => {
    return aggregateDayForecasts(forecasts, beach, {
      maxDays: 12,
      timezone: beachTimezone || undefined,
    });
  }, [forecasts, beach, beachTimezone]);

  // Lookup horizon summaries by date for 5-Day Outlook wave range display
  const horizonSummaryByDate = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const summary of horizonDaySummaries) {
      map.set(summary.fullDate, summary);
    }
    return map;
  }, [horizonDaySummaries]);

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

  const firstHiddenOutlookDayName = useMemo(() => {
    if (!publicMode || miniForecastDays.length <= 3) return null;
    const hiddenDay = miniForecastDays[3];
    if (!hiddenDay?.date) return null;
    try {
      return new Date(`${hiddenDay.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });
    } catch {
      return null;
    }
  }, [publicMode, miniForecastDays]);

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
  const heroPeriod = formatMetric(currentForecast?.wave_period);

  // Dynamic tide display with fallback to static forecast values
  const heroNextTideType = dynamicTide.nextTide
    ? dynamicTide.nextTide.type === "high"
      ? "High Tide"
      : "Low Tide"
    : currentForecast?.next_tide_type ?? "—";

  const heroNextTideHeight = dynamicTide.nextTide
    ? `${dynamicTide.nextTide.height.toFixed(1)} ft`
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

  // Generate tide diagnostics from forecast data for enhanced tide components
  // Depends on dynamicTide to recompute when user returns to tab (visibility change)
  const tideDiagnostics = useMemo(() => {
    if (!forecasts || forecasts.length === 0) return null;
    return generateTideDiagnosticsFromForecasts(forecasts, {
      beachName: beach.name,
      stationName: beach.name,
      isPrimaryStation: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecasts, beach.name, dynamicTide.minutesUntil]);

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
                  track("signup_cta_click", { source: "horizon-strip-outlook" });
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
        onValueChange={(value) => setActiveSubTab(value as typeof activeSubTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 gap-2 rounded-full bg-blue-100/60 p-1">
          <TabsTrigger
            value="today"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-ocean-blue data-[state=active]:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue"
            onClick={() =>
              track("forecast_subtab_click", {
                beach_slug: slugify(beach.name),
                tab: "today",
              })
            }
          >
            <Sun className="h-4 w-4" />
            <span>Today</span>
          </TabsTrigger>
          <TabsTrigger
            value="tides"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-ocean-blue data-[state=active]:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue"
            onClick={() =>
              track("forecast_subtab_click", {
                beach_slug: slugify(beach.name),
                tab: "tides",
              })
            }
          >
            <Waves className="h-4 w-4" />
            <span>Tides</span>
          </TabsTrigger>
          <TabsTrigger
            value="conditions"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-ocean-blue data-[state=active]:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue"
            onClick={() =>
              track("forecast_subtab_click", {
                beach_slug: slugify(beach.name),
                tab: "conditions",
              })
            }
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
                  <h2 className="text-xl font-roboto font-semibold text-dark-grey">
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                  <div className="flex flex-col gap-4 rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-ocean-blue/5 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-ocean-blue">
                        Current Tide
                      </div>
                      <div className="mt-2 text-2xl font-bold text-dark-grey">
                        {getCurrentTideDisplay()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Next: {heroNextTideType} @ {getNextTideTimeDisplay()}
                      </div>
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ocean-blue/10 self-start sm:self-auto">
                      <TideIcon className="h-8 w-8 text-ocean-blue" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-blue-100/40 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-ocean-blue">
                        Wind
                      </div>
                      <div className="mt-2 text-2xl font-bold text-dark-grey">
                        {currentForecast?.wind_speed ?? "—"}
                      </div>
                      <div className="text-sm text-muted-foreground uppercase">
                        {currentForecast?.wind_direction ?? "—"}
                      </div>
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ocean-blue/10 self-start sm:self-auto">
                      <Wind className="h-8 w-8 text-ocean-blue" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-blue-100/30 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-ocean-blue">
                        Swell
                      </div>
                      <div className="mt-2 text-2xl font-bold text-dark-grey">
                        {heroWaveHeight} ft
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {snapshotSwellDetails}
                      </div>
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ocean-blue/10 self-start sm:self-auto">
                      <Waves className="h-8 w-8 text-ocean-blue" />
                    </div>
                  </div>
                </div>

                {/* Secondary Conditions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {/* Swell Direction */}
                  <div className="rounded-xl bg-gray-50/80 p-3 border border-gray-100">
                    <div className="text-xs text-muted-foreground mb-1">Swell Direction</div>
                    <div className="text-sm font-semibold text-dark-grey">
                      {currentForecast?.swell_1_direction ?? "—"}
                    </div>
                  </div>

                  {/* Water Temp */}
                  <div className="rounded-xl bg-gray-50/80 p-3 border border-gray-100">
                    <div className="text-xs text-muted-foreground mb-1">Water Temp</div>
                    <div className="text-sm font-semibold text-dark-grey">
                      {currentForecast?.water_temp ? `${String(currentForecast.water_temp).replace(/°F$/, "")}°F` : "—"}
                    </div>
                  </div>

                  {/* Next Tide */}
                  <div className="rounded-xl bg-gray-50/80 p-3 border border-gray-100">
                    <div className="text-xs text-muted-foreground mb-1">Next Tide</div>
                    <div className="text-sm font-semibold text-dark-grey">
                      {heroNextTideType} @ {getNextTideTimeDisplay()}
                    </div>
                  </div>

                  {/* Sunrise/Sunset */}
                  <div className="rounded-xl bg-gray-50/80 p-3 border border-gray-100">
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
              />
            );
            return publicMode ? (
              <PublicContentGate
                ctaTitle="See the Best Time to Surf Today"
                ctaDescription="Sign up to unlock AI-powered surf window analysis — we find the optimal conditions for you"
                blurLevel="md"
                source="best-window-gate"
                className="min-h-[200px]"
              >
                {bestSurfWindowContent}
              </PublicContentGate>
            ) : bestSurfWindowContent;
          })()}

          {/* 5-Day Outlook */}
          {forecasts.length > 0 && (
            <section className="rounded-3xl border border-blue-100/60 bg-white/95 p-6 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-roboto font-semibold text-dark-grey">
                  {publicMode ? "3-Day Outlook" : "5-Day Outlook"}
                </h2>
                <span className="text-sm text-muted-foreground">
                  Quick glance forecast
                </span>
              </div>
              {miniForecastDays.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {visibleDays.map(({ date, forecast }) => {
                    const label = (() => {
                      try {
                        return new Date(`${date}T00:00:00`).toLocaleDateString(
                          undefined,
                          { weekday: "short" }
                        );
                      } catch {
                        return date;
                      }
                    })();
                    const periodDisplay = formatMetric(forecast.wave_period);
                    const windDirection = forecast.wind_direction ?? "";
                    const swellDirection = forecast.wave_direction ?? "—";
                    const swellDetails =
                      periodDisplay === "—"
                        ? `— · ${swellDirection}`
                        : `${periodDisplay} s · ${swellDirection}`;
                    const daySummary = horizonSummaryByDate.get(date);
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => {
                          setSelectedDay(date);
                          setSelectedForecastEntry(forecast);
                          setIsModalOpen(true);
                        }}
                        className="group rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-blue-50/60 to-white p-3 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ocean-blue/40"
                      >
                        <div className="text-xs font-medium text-muted-foreground" suppressHydrationWarning>
                          <span>{label}</span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          {daySummary ? (
                            <span className="text-2xl font-bold text-ocean-blue">
                              {formatWaveRange(daySummary.minHeight, daySummary.maxHeight)}
                            </span>
                          ) : forecast.wave_height == null && forecast.wave_period == null ? (
                            <span className="text-lg font-medium text-muted-foreground">
                              No data
                            </span>
                          ) : (
                            <>
                              <span className="text-2xl font-bold text-ocean-blue">
                                {formatMetric(forecast.wave_height)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ft
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Wind className="h-3 w-3" />
                          <span>{forecast.wind_speed ?? "—"}</span>
                          <span className="uppercase">{windDirection}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {swellDetails}
                        </div>
                      </button>
                    );
                  })}
                  {publicMode && hiddenDaysCount > 0 && (
                    <>
                      <button
                        type="button"
                        className="col-span-1 flex flex-col items-center justify-center rounded-2xl
                          border border-dashed border-ocean-blue/15 bg-gradient-to-br from-blue-50/50 to-cyan-50/30
                          p-4 text-center cursor-pointer
                          hover:border-ocean-blue/25 hover:bg-blue-50/70 transition-all"
                        onClick={() => {
                          track("signup_cta_click", { source: "5day-outlook-card" });
                          trackAuthModalOpened({ mode: "signup", source: "5day-outlook-card" });
                          setOutlookAuthModal(true);
                        }}
                      >
                        <CalendarDays className="h-5 w-5 text-ocean-blue/50 mb-1.5" />
                        <p className="text-xs font-medium text-gray-700">
                          {firstHiddenOutlookDayName ?? `+${hiddenDaysCount} more`}
                        </p>
                        <p className="text-[11px] text-ocean-blue mt-1 font-medium">
                          See what's coming
                        </p>
                      </button>
                      <UnifiedAuthModal
                        isOpen={outlookAuthModal}
                        onClose={() => setOutlookAuthModal(false)}
                        mode="signup"
                        source="5day-outlook-card"
                        contextMessage={{
                          title: "See the Full Outlook",
                          description: "Plan your week with the 12-day forecast",
                        }}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Collapsible Detailed Forecast */}
              <Collapsible className="mt-6">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between rounded-2xl hover:bg-blue-50/50"
                  >
                    <span className="text-sm font-medium">
                      View Detailed {publicMode ? "3" : "5"}-Day Forecast
                    </span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4">
                    <SimplifiedForecastTable forecasts={publicFilteredForecasts} beachTimezone={beachTimezone} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </section>
          )}
        </TabsContent>

        {/* Tides Tab */}
        <TabsContent value="tides" className="mt-6">
          <section className="rounded-3xl border border-blue-100/60 bg-white/95 p-6 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-roboto font-semibold text-dark-grey">
                Tide Forecast
              </h2>
              <EmbedCodeButton beachSlug={beach.slug} beachName={beach.name} />
            </div>
            <TideChartEnhanced
              forecasts={forecasts}
              diagnostics={tideDiagnostics ?? undefined}
              compact={false}
              now={new Date()}
              showNextExtreme={!!tideDiagnostics}
              showHourlyTable={true}
              showWarnings={true}
              showVerifiedBadge={!!tideDiagnostics}
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

      {/* Detailed Swell Modal */}
      <DetailedSwellModal
        forecast={
          selectedForecastEntry ||
          (selectedDay ? forecastsByDate[selectedDay]?.[0] || null : null)
        }
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDay(null);
          setSelectedForecastEntry(null);
        }}
        selectedDate={selectedDay}
      />
    </div>
    </DataErrorBoundary>
  );
}

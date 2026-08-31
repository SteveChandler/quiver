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
  AlertTriangle,
} from "lucide-react";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { BeachForecastMetadata } from "@/hooks/use-beach-detail-data";
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
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import { EmbedCodeButton } from "@/components/beach-detail/embed-code-modal";
import { DataErrorBoundary } from "@/components/error-boundaries";
import { TideStatusStrip } from "@/components/beach-detail/tide-status-strip";
import { TideChartSection } from "@/components/beach-detail/tide-chart-section";
import { useAuth } from "@/context/auth-context";
import { useOptionalProfileContext } from "@/context/profile-context";
import { ForecastFeedbackCapture } from "@/components/forecast/forecast-feedback-capture";

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
  forecastMetadata?: BeachForecastMetadata | null;
  beachTimezone?: string | null;
  surfCall?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;
  defaultSubTab?: "today" | "tides" | "conditions";
  yesterdayAccuracy?: YesterdayAccuracy | null;
}

export function ForecastTab({
  beach,
  forecasts,
  currentForecast,
  forecastMetadata,
  beachTimezone,
  surfCall,
  surfCallIsTomorrow,
  defaultSubTab,
  yesterdayAccuracy,
}: ForecastTabProps) {


  const { track: trackEvent } = useTrackEvent();
  const { user } = useAuth();
  const profileContext = useOptionalProfileContext();
  const profileExperienceLevel = profileContext?.profile?.experience_level ?? null;
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

  const todayStr = useMemo(() => {
    return getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone));
  }, [beachTimezone]);

  // Fetch sunrise/sunset times for today
  const { sunrise, sunset } = useSunTimes(beach.id, todayStr);

  const todaySunTimesCache = useMemo(() => {
    if (!sunrise && !sunset) return undefined;
    return new Map([
      [
        beach.id,
        {
          sunrises: sunrise ? [sunrise] : [],
          sunsets: sunset ? [sunset] : [],
        },
      ],
    ]);
  }, [beach.id, sunrise, sunset]);

  // Horizon Strip: aggregated day summaries (12 days, ungated for all users)
  const horizonDaySummaries = useMemo(() => {
    return aggregateDayForecasts(forecasts, beach, {
      maxDays: 12,
      timezone: beachTimezone || undefined,
      skillLevel: profileExperienceLevel,
      sunTimesCache: todaySunTimesCache,
    });
  }, [forecasts, beach, beachTimezone, profileExperienceLevel, todaySunTimesCache]);

  // Forecasts filtered by horizon strip selection
  const selectedDateForecasts = useMemo(() => {
    if (!horizonSelectedDate) return forecasts;
    const tz = resolveBeachTimezone(beachTimezone);
    return forecasts.filter((f) => extractForecastDate(f.forecast_at, tz) === horizonSelectedDate);
  }, [forecasts, horizonSelectedDate, beachTimezone]);

  const todaysForecasts = useMemo(
    () => {
      const tz = resolveBeachTimezone(beachTimezone);
      return forecasts.filter((f) => extractForecastDate(f.forecast_at, tz) === todayStr);
    },
    [forecasts, todayStr, beachTimezone]
  );

  // Condition Intelligence: scored windows, board pick, relative context
  // Passing full forecasts so the hook can group by date and compute weekly context
  const conditionIntel = useConditionIntelligence(
    forecasts,
    beach,
    beachTimezone,
    profileExperienceLevel
  );

  // Dynamic tide computation (always fresh, relative to now)
  const dynamicTide = useDynamicTide(forecasts, beachTimezone);

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
  const isDisplayStaleForecast =
    Boolean(forecastMetadata?.displayStale) && forecasts.length > 0;
  const freshnessLabel = useMemo(() => {
    if (forecastMetadata?.dataAge) return forecastMetadata.dataAge;
    if (!forecastMetadata?.lastUpdated) return null;

    const updatedAt = new Date(forecastMetadata.lastUpdated).getTime();
    if (Number.isNaN(updatedAt)) return null;

    const ageMs = Date.now() - updatedAt;
    const ageHours = Math.max(0, Math.round(ageMs / (1000 * 60 * 60)));
    if (ageHours < 1) return "less than 1h old";
    return `${ageHours}h old`;
  }, [forecastMetadata?.dataAge, forecastMetadata?.lastUpdated]);
  const currentForecastTimeLabel =
    currentForecast?.forecast_at && beachTimezone
      ? formatTimeInBeachTimezone(currentForecast.forecast_at, beachTimezone)
      : currentForecast?.forecast_time
        ? formatTimeString(currentForecast.forecast_time)
        : null;

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
      {isDisplayStaleForecast && (
        <div
          data-testid="stale-forecast-banner"
          className="flex flex-col gap-2 rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] px-4 py-3 shadow-[3px_3px_0_#11100D] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C46A24]" />
            <p className="text-sm font-medium text-[#11100D]">
              Forecast is updating. Showing cached model data
              {freshnessLabel ? ` from ${freshnessLabel}` : ""}; current
              conditions may have changed.
            </p>
          </div>
          {forecastMetadata?.dataSource && (
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#0B3A75]">
              {forecastMetadata.dataSource}
            </span>
          )}
        </div>
      )}

      {/* 12-Day Horizon Strip — all 12 days visible to every user. */}
      {forecasts.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-4 sm:px-6">
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
          />
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
        <TabsList className="grid w-full grid-cols-3 gap-1 rounded-full border-2 border-[#11100D] bg-[#F4EBD8] p-1 shadow-[2px_2px_0_#11100D]">
          <TabsTrigger
            value="today"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 font-heading text-sm font-black uppercase text-[#5F5646] transition-[color,background-color,box-shadow] data-[state=active]:bg-[#11100D] data-[state=active]:text-[#F4EBD8] data-[state=active]:shadow-[0_2px_0_#F78E42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
          >
            <Sun className="h-4 w-4" />
            <span>Today</span>
          </TabsTrigger>
          <TabsTrigger
            value="tides"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 font-heading text-sm font-black uppercase text-[#5F5646] transition-[color,background-color,box-shadow] data-[state=active]:bg-[#11100D] data-[state=active]:text-[#F4EBD8] data-[state=active]:shadow-[0_2px_0_#F78E42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
          >
            <Waves className="h-4 w-4" />
            <span>Tides</span>
          </TabsTrigger>
          <TabsTrigger
            value="conditions"
            className="flex items-center justify-center gap-2 rounded-full px-3 py-2 font-heading text-sm font-black uppercase text-[#5F5646] transition-[color,background-color,box-shadow] data-[state=active]:bg-[#11100D] data-[state=active]:text-[#F4EBD8] data-[state=active]:shadow-[0_2px_0_#F78E42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
          >
            <Globe2 className="h-4 w-4" />
            <span>Conditions</span>
          </TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-6 mt-6">
          {/* Current Forecast Snapshot */}
          {currentForecast && (
            <section className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-4 shadow-[4px_4px_0_#11100D] md:p-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="relative font-heading text-xl font-black uppercase text-[#11100D]">
                    {isDisplayStaleForecast
                      ? "Forecasted Conditions"
                      : "Current Conditions"}
                  </h2>
                  <span className="relative max-w-full rounded-full border-2 border-[#11100D] bg-[#EFE5CF] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#0B3A75]">
                    {isDisplayStaleForecast
                      ? `Forecast for ${currentForecastTimeLabel ?? "selected slot"}${
                          freshnessLabel
                            ? ` · model updated ${freshnessLabel}`
                            : ""
                        }`
                      : "Current conditions"}
                  </span>
                </div>

                {/* Tide Alert */}
                {beach.preferred_tide_direction && (
                  <TideAlertBadge alert={tideAlert} />
                )}

                <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
                  <div className="relative flex flex-col items-center gap-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-3 shadow-[2px_2px_0_#11100D] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] sm:order-last sm:h-14 sm:w-14">
                      <TideIcon className="h-5 w-5 text-[#11100D] sm:h-7 sm:w-7" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#C46A24]">
                        Tide
                      </div>
                      <div className="mt-0.5 font-heading text-base font-black text-[#11100D] sm:mt-2 sm:text-2xl">
                        {getCurrentTideDisplay()}
                      </div>
                      <div className="hidden text-sm font-medium text-[#5F5646] sm:block">
                        Next: {heroNextTideType} @ {getNextTideTimeDisplay()}
                      </div>
                    </div>
                  </div>
                  <div className="relative flex flex-col items-center gap-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-3 shadow-[2px_2px_0_#11100D] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#0B3A75] sm:order-last sm:h-14 sm:w-14">
                      <Wind className="h-5 w-5 text-[#F4EBD8] sm:h-7 sm:w-7" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0B3A75]">
                        Wind
                      </div>
                      <div className="mt-0.5 font-heading text-base font-black text-[#11100D] sm:mt-2 sm:text-2xl">
                        {currentForecast?.wind_speed ?? "—"}
                      </div>
                      <div className="text-xs font-medium uppercase text-[#5F5646] sm:text-sm">
                        {currentForecast?.wind_direction ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="relative flex flex-col items-center gap-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-3 shadow-[2px_2px_0_#11100D] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] sm:order-last sm:h-14 sm:w-14">
                      <Waves className="h-5 w-5 text-[#11100D] sm:h-7 sm:w-7" />
                    </div>
                    <div className="text-center sm:text-left sm:flex-1">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#C46A24]">
                        Swell
                      </div>
                      <div className="mt-0.5 font-heading text-base font-black text-[#11100D] sm:mt-2 sm:text-2xl">
                        {heroWaveHeight === "—" ? (
                          "— ft"
                        ) : (
                          <WaveHeightDisplay
                            height={`${heroWaveHeight} ft`}
                            isCalibrated={beachIsCalibrated}
                            showTooltip={true}
                            className="text-base font-black text-[#11100D] sm:text-2xl"
                          />
                        )}
                      </div>
                      <div className="text-xs font-medium text-[#5F5646] sm:text-sm">
                        {snapshotSwellDetails}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secondary Conditions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-3 sm:mt-4">
                  {/* Swell Direction */}
                  <div className="relative rounded-[8px] border-2 border-[#11100D] bg-[#F8F0DF] p-2 shadow-[2px_2px_0_#11100D] sm:p-3">
                    <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#5F5646]">Swell Direction</div>
                    <div className="text-sm font-black text-[#11100D]">
                      {currentForecast?.swell_1_direction ?? "—"}
                    </div>
                  </div>

                  {/* Water Temp */}
                  <div className="relative rounded-[8px] border-2 border-[#11100D] bg-[#F8F0DF] p-2 shadow-[2px_2px_0_#11100D] sm:p-3">
                    <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#5F5646]">Water Temp</div>
                    <div className="text-sm font-black text-[#11100D]">
                      {currentForecast?.water_temp ? `${String(currentForecast.water_temp).replace(/°F$/, "")}°F` : "—"}
                    </div>
                  </div>

                  {/* Next Tide */}
                  <div className="relative rounded-[8px] border-2 border-[#11100D] bg-[#F8F0DF] p-2 shadow-[2px_2px_0_#11100D] sm:p-3">
                    <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#5F5646]">Next Tide</div>
                    <div className="text-sm font-black text-[#11100D]">
                      {heroNextTideType} @ {getNextTideTimeDisplay()}
                    </div>
                  </div>

                  {/* Sunrise/Sunset */}
                  <div className="relative rounded-[8px] border-2 border-[#11100D] bg-[#F8F0DF] p-2 shadow-[2px_2px_0_#11100D] sm:p-3">
                    <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#5F5646]">Daylight</div>
                    <div className="text-sm font-black text-[#11100D]">
                      {sunrise && sunset
                        ? `${formatSunTime(sunrise)} - ${formatSunTime(sunset)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {user && currentForecast && (
            <ForecastFeedbackCapture
              beach={beach}
              forecast={currentForecast}
              forecastMetadata={forecastMetadata}
              surfCall={surfCall}
              beachTimezone={beachTimezone}
              isCalibrated={beachIsCalibrated}
              isDisplayStaleForecast={isDisplayStaleForecast}
              forecastTimeLabel={currentForecastTimeLabel}
              freshnessLabel={freshnessLabel}
            />
          )}

          {/* Yesterday's Accuracy */}
          {yesterdayAccuracy?.should_display && (
            <YesterdaysAccuracyCard accuracy={yesterdayAccuracy} />
          )}

          {/* Best Surf Window — authenticated users only. */}
          {user && surfCall?.verdict !== "NO" && (
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
              peakScore: w.peakScore,
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
          )}
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
            horizonDaySummaries={horizonDaySummaries}
            forecasts={forecasts}
            beach={beach}
            selectedDate={horizonSelectedDate}
            beachTimezone={beachTimezone}
          />
        </TabsContent>
      </Tabs>

    </div>
    </DataErrorBoundary>
  );
}

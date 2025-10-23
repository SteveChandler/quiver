"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ArrowUp, ArrowDown, Waves, Wind } from "lucide-react";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { getTodayDateString } from "@/lib/utils/forecast-ui-utils";

const ForecastAndTides = dynamic(
  () =>
    import("@/components/beach-detail/forecast-and-tides").then(
      (m) => m.ForecastAndTides
    ),
  { ssr: false }
);

const CamsSection = dynamic(
  () =>
    import("@/components/beach-detail/cams-section").then((m) => m.CamsSection),
  { ssr: false }
);

const DetailedSwellModal = dynamic(
  () =>
    import("@/components/beach-detail/detailed-swell-modal").then(
      (m) => m.DetailedSwellModal
    ),
  { ssr: false }
);

interface ForecastTabProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  currentForecast: EnhancedForecastEntity | null;
  hasCamera: boolean;
}

export function ForecastTab({
  beach,
  forecasts,
  currentForecast,
  hasCamera,
}: ForecastTabProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedForecastEntry, setSelectedForecastEntry] =
    useState<EnhancedForecastEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const forecastsByDate = useMemo(() => {
    const grouped: Record<string, EnhancedForecastEntity[]> = {};

    if (forecasts && Array.isArray(forecasts) && forecasts.length > 0) {
      forecasts.forEach((forecast) => {
        if (forecast && forecast.forecast_date) {
          const date = forecast.forecast_date;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push(forecast);
        }
      });
    }

    return grouped;
  }, [forecasts]);

  const sortedDates = useMemo(
    () => Object.keys(forecastsByDate).sort(),
    [forecastsByDate]
  );

  const miniForecastDays = useMemo(() => {
    const today = getTodayDateString();
    return sortedDates
      .filter((date) => date >= today)
      .slice(0, 5)
      .map((date) => {
        const dayEntries = forecastsByDate[date] || [];
        if (!dayEntries.length) {
          return null;
        }
        const middayEntry = dayEntries.find((entry) =>
          (entry.forecast_time || "").startsWith("12")
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
  }, [sortedDates, forecastsByDate]);

  const formatMetric = (value: string | number | null | undefined, decimals = 1, fallback = "—") => {
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

  const formatTimeString = (time?: string | null) => {
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

  const tideTrend = (currentForecast?.tide_status || "").toLowerCase();
  const TideIcon =
    tideTrend === "rising"
      ? ArrowUp
      : tideTrend === "falling"
      ? ArrowDown
      : Waves;

  const heroWaveHeight = formatMetric(currentForecast?.wave_height);
  const heroPeriod = formatMetric(currentForecast?.wave_period);
  const heroNextTideHeight = currentForecast?.next_tide_height ?? "";
  const heroNextTideType = currentForecast?.next_tide_type ?? "—";
  const snapshotSwellPeriod = formatMetric(currentForecast?.wave_period);
  const snapshotDirection = currentForecast?.wave_direction ?? "—";
  const snapshotSwellDetails =
    snapshotSwellPeriod === "—"
      ? `— · ${snapshotDirection}`
      : `${snapshotSwellPeriod} s · ${snapshotDirection}`;

  return (
    <div className="space-y-6 py-6">
      {/* Current Forecast Snapshot */}
      {currentForecast && (
        <section className="rounded-3xl bg-white/95 p-4 md:p-6 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-roboto font-semibold text-dark-grey">
                Current Conditions
              </h2>
              <span className="text-sm text-muted-foreground">
                Right now
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-ocean-blue/5 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-[0.2em] text-ocean-blue">
                    Next Tide
                  </div>
                  <div className="mt-2 text-2xl font-bold text-dark-grey">
                    {heroNextTideType}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {heroNextTideHeight} ·{" "}
                    {formatTimeString(currentForecast?.next_tide_time)}
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
          </div>
        </section>
      )}

      {/* Live Cam */}
      {hasCamera && (
        <section id="live-cam" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-roboto font-semibold text-dark-grey">
              Live Cam
            </h2>
            <span className="text-sm text-muted-foreground">
              Watch the lineup in real time
            </span>
          </div>
          <CamsSection beachId={beach.id} />
        </section>
      )}

      {/* 5-Day Outlook */}
      {forecasts.length > 0 && (
        <section className="rounded-3xl bg-white/95 p-6 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-roboto font-semibold text-dark-grey">
              5-Day Outlook
            </h2>
            <span className="text-sm text-muted-foreground">
              Detailed forecast and tides
            </span>
          </div>
          {miniForecastDays.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {miniForecastDays.map(({ date, forecast }) => {
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
                    <div className="text-xs font-medium text-muted-foreground">
                      <span>{label}</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-ocean-blue">
                        {formatMetric(forecast.wave_height)}
                      </span>
                      <span className="text-sm text-muted-foreground">ft</span>
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
            </div>
          )}
          <div className="mt-6">
            <ForecastAndTides beach={beach as Beach} forecasts={forecasts} />
          </div>
        </section>
      )}

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
  );
}

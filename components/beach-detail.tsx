"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CloudSun,
  Compass,
  MapPin,
  MessageSquare,
  Star,
  Waves,
  Wind,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BeachIntelSection = dynamic(
  () =>
    import("@/components/intel/beach-intel-section").then(
      (m) => m.BeachIntelSection
    ),
  { ssr: false }
);
const SessionForecastComparison = dynamic(
  () =>
    import("@/components/forecast/session-forecast-comparison").then(
      (m) => m.SessionForecastComparison
    ),
  { ssr: false }
);
const DetailedSwellModal = dynamic(
  () =>
    import("@/components/beach-detail/detailed-swell-modal").then(
      (m) => m.DetailedSwellModal
    ),
  { ssr: false }
);
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { SpotOverview } from "@/components/beach-detail/spot-overview";
import { FavoriteButton } from "@/components/favorite-button";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";
// Replacing BeachCheckIns with BeachIntelSection in Local Intel section
const ForecastAndTides = dynamic(
  () =>
    import("@/components/beach-detail/forecast-and-tides").then(
      (m) => m.ForecastAndTides
    ),
  { ssr: false }
);
const BeachReviewSummary = dynamic(
  () =>
    import("@/components/beach/beach-review-summary").then(
      (m) => m.BeachReviewSummary
    ),
  { ssr: false }
);
const BeachReviewsList = dynamic(
  () =>
    import("@/components/beach/beach-reviews-list").then(
      (m) => m.BeachReviewsList
    ),
  { ssr: false }
);
const CamsSection = dynamic(
  () =>
    import("@/components/beach-detail/cams-section").then((m) => m.CamsSection),
  { ssr: false }
);
const RecentSessionsSection = dynamic(
  () =>
    import("@/components/beach-detail/recent-sessions-section").then(
      (m) => m.RecentSessionsSection
    ),
  { ssr: false }
);
const CrowdTipsSection = dynamic(
  () =>
    import("@/components/beach-detail/crowd-tips-section").then(
      (m) => m.CrowdTipsSection
    ),
  { ssr: false }
);
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import { track, slugify } from "@/lib/analytics";
import { FullPageLoader } from "@/components/ui/loading-states";

interface BeachDetailProps {
  id: string;
}

export function BeachDetail({ id }: BeachDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedForecastEntry, setSelectedForecastEntry] =
    useState<EnhancedForecastEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle URL parameters and default section opening
  useEffect(() => {
    // Prefer query param, fallback to hash
    const sectionParam = searchParams?.get("section");
    const hash = typeof window !== "undefined" ? window.location.hash : "";

    const wantsIntel = sectionParam === "intel" || hash === "#intel";

    if (wantsIntel) {
      // Scroll into view after layout settles, accounting for sticky header
      const stickyOffset = 80; // px; header + spacing
      setTimeout(() => {
        const el =
          document.getElementById("intel") ||
          document.getElementById("intel-section");
        if (el) {
          try {
            const url = new URL(window.location.href);
            url.hash = "intel";
            window.history.replaceState({}, "", url.toString());
          } catch {}
          const y =
            el.getBoundingClientRect().top + window.scrollY - stickyOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch forecast calibration data
  const { sessionSnapshots } = useForecastCalibration({ beachId: id });

  // Review handlers
  const handleWriteReview = useCallback(() => {
    setReviewDialogOpen(true);
  }, []);

  const handleReviewSuccess = useCallback(() => {
    setReviewDialogOpen(false);
    setReviewRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch beach information via API (avoid server actions from client)
  const fetchBeach = useCallback(async () => {
    console.log("🏖️ Fetching beach data (API) for:", id);
    const res = await fetch(`/api/beaches/${id}`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Failed to fetch beach: ${res.status}`);
    }
    const body = (await res.json().catch(() => ({}))) as {
      data?: { beach?: Beach } | Beach;
      beach?: Beach;
    };
    const beachData =
      (body as any)?.data?.beach || (body as any)?.beach || (body as any)?.data;
    if (!beachData) throw new Error("Beach data not found");
    console.log("✅ Beach data:", beachData);
    return beachData as Beach;
  }, [id]);

  const {
    data: beach,
    loading: beachLoading,
    error: beachError,
  } = useDataFetcher(fetchBeach, {
    immediate: true,
  });

  // Single data fetch - 10-day enhanced forecast via API
  const fetchForecasts = useCallback(async () => {
    console.log("🚀 Starting enhanced forecast fetch (API) for beach:", id);
    const res = await fetch(
      `/api/forecasts/update-enhanced?beachId=${id}&days=10`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body?.error || `Failed to fetch enhanced forecasts: ${res.status}`
      );
    }
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { forecasts?: EnhancedForecastEntity[] };
      forecasts?: EnhancedForecastEntity[];
      error?: string;
    };
    const forecasts: EnhancedForecastEntity[] =
      body?.data?.forecasts || (body as any)?.forecasts || [];
    console.log("🔍 Raw forecast data:", {
      totalForecasts: forecasts.length,
      dateRange: {
        first: forecasts[0]?.forecast_date,
        last: forecasts[forecasts.length - 1]?.forecast_date,
      },
      sampleForecast: forecasts[0],
      uniqueDates: [...new Set(forecasts.map((f) => f.forecast_date))],
      forecastsByDate: forecasts.reduce((acc, f) => {
        acc[f.forecast_date] = (acc[f.forecast_date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });
    return forecasts;
  }, [id]);

  const {
    data: forecasts,
    loading: forecastsLoading,
    error: forecastsError,
    refetch,
  } = useDataFetcher(fetchForecasts, {
    immediate: true,
    initialData: [] as EnhancedForecastEntity[],
  });

  // Combined loading and error states
  const loading = beachLoading || forecastsLoading;
  const error = beachError || forecastsError;

  // Track beach view once we have data
  // Note: Hooks must run unconditionally on every render (before any return)
  useEffect(() => {
    if (!beach) return;
    try {
      const isHome = (searchParams?.get("from") || "") === "home";
      track("beach_view", {
        beach_slug: slugify(beach.name),
        region: (beach as any).region || (beach as any).location || undefined,
        is_home: isHome,
      });
    } catch {}
    // only on first load per beach id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beach?.id]);

  // Select the best forecast using the same time-aware logic as home page
  const currentForecast = useMemo(() => {
    if (!forecasts || forecasts.length === 0) return null;

    // Use the same getCurrentForecast utility as the home page for consistency
    const {
      getCurrentForecast,
    } = require("@/lib/utils/current-forecast-utils");
    const selectedForecast = getCurrentForecast(forecasts);

    console.log("🏖️ Beach Detail currentForecast selection:", {
      totalForecasts: forecasts.length,
      selectedTime: selectedForecast?.forecast_time,
      selectedWaveHeight: selectedForecast?.wave_height,
      firstForecastTime: forecasts[0]?.forecast_time,
      firstForecastWaveHeight: forecasts[0]?.wave_height,
      isClient: typeof window !== "undefined",
    });

    return selectedForecast;
  }, [forecasts]);

  // Process data for display - memoized to prevent unnecessary recalculations
  const forecastsByDate = useMemo(() => {
    const grouped: Record<string, EnhancedForecastEntity[]> = {};

    if (forecasts && Array.isArray(forecasts) && forecasts.length > 0) {
      console.log("📊 Processing forecasts:", {
        totalForecasts: forecasts.length,
        firstForecast: forecasts[0],
      });

      // Group forecasts by date
      forecasts.forEach((forecast) => {
        if (forecast && forecast.forecast_date) {
          const date = forecast.forecast_date;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push(forecast);
        }
      });

      console.log("📅 Grouped forecasts by date:", {
        dates: Object.keys(grouped),
        forecastsPerDate: Object.entries(grouped).map(([date, forecasts]) => ({
          date,
          count: forecasts.length,
          firstForecast: forecasts[0]?.wave_height,
        })),
      });
    }

    return grouped;
  }, [forecasts]);

  // Get the first day's forecast for overview
  const sortedDates = useMemo(
    () => Object.keys(forecastsByDate).sort(),
    [forecastsByDate]
  );

  const miniForecastDays = useMemo(
    () =>
      sortedDates
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
      }[],
    [sortedDates, forecastsByDate]
  );

  const formatMetric = (
    value: string | number | null | undefined,
    {
      decimals = 1,
      fallback = "—",
    }: { decimals?: number; fallback?: string } = {}
  ) => {
    if (value === null || value === undefined) {
      return fallback;
    }
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

  const locationLabel =
    beach?.location || beach?.region || beach?.country || "Untitled coastline";

  const tideTrend = (currentForecast?.tide_status || "").toLowerCase();
  const TideIcon =
    tideTrend === "rising"
      ? ArrowUp
      : tideTrend === "falling"
      ? ArrowDown
      : Waves;

  const hasForecasts = Array.isArray(forecasts) && forecasts.length > 0;

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

  // Prioritize loading state to prevent erroneous "not found" flash
  if (loading) {
    return <FullPageLoader />;
  }

  // After loading finishes, show error only if we truly have an error or no beach
  if (error || !beach) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        <div className="text-center">
          <h2 className="text-xl font-roboto font-bold mb-2 text-dark-grey">
            {error || "Beach data not found"}
          </h2>
          <Button
            onClick={() => router.push("/map")}
            className="bg-ocean-blue hover:bg-ocean-blue/90"
          >
            Back to Map
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sandy-beige via-white to-blue-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-ocean-blue/95 via-blue-700/90 to-blue-600/90 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/map")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Map
          </Button>
          <span className="ml-3 text-xs uppercase tracking-[0.35em] text-white/70">
            Surf Guide
          </span>
          <span className="ml-auto text-base font-semibold">{beach.name}</span>
        </div>
      </header>

      <main className="pb-24">
        <section className="relative overflow-hidden bg-gradient-to-br from-ocean-blue via-blue-700 to-blue-600 text-white">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-blue-400/30 blur-3xl" />
          </div>
          <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-2 sm:px-4 py-12 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70">
                Today
              </div>
              <h1 className="text-4xl font-roboto font-extrabold tracking-tight md:text-5xl">
                {beach.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {locationLabel}
                </span>
                {beach.latitude != null && beach.longitude != null ? (
                  <span className="inline-flex items-center gap-2">
                    <Compass className="h-4 w-4" />
                    {beach.latitude.toFixed(2)}°, {beach.longitude.toFixed(2)}°
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-white/85">
                {currentForecast?.weather_condition ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                    <CloudSun className="h-4 w-4" />
                    {currentForecast.weather_condition}
                  </span>
                ) : null}
                {currentForecast?.tide_status ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                    <Waves className="h-4 w-4" />
                    {currentForecast.tide_status} tide
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <FavoriteButton
                  beachId={beach.id}
                  variant="outline"
                  size="sm"
                />
                <div className="w-48">
                  <HomeBeachBanner
                    selectedBeachId={beach.id}
                    selectedBeachName={beach.name}
                  />
                </div>
              </div>
              <p className="max-w-xl text-sm text-white/80">
                Live conditions, short-term tides, and crew intel—everything you
                need before you paddle out.
              </p>
            </div>
            <Card className="w-full max-w-sm border-none bg-white/95 shadow-2xl">
              <CardContent className="space-y-6 p-6">
                <div>
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Wave Height
                  </span>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-6xl font-roboto font-extrabold text-ocean-blue">
                      {heroWaveHeight}
                    </span>
                    <span className="text-xl font-semibold text-slate-500">
                      ft
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-100/70 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Period
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-800">
                      {heroPeriod}
                      {heroPeriod === "—" ? null : (
                        <span className="ml-1 text-xs font-medium text-slate-500">
                          s
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-100/70 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Conditions
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-800">
                      {currentForecast?.weather_condition ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-100/70 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Next Tide
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-800">
                      {heroNextTideType}
                    </div>
                    <div className="text-xs text-slate-500">
                      {heroNextTideHeight} ·{" "}
                      {formatTimeString(currentForecast?.next_tide_time)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="relative z-10 mx-auto -mt-12 max-w-6xl space-y-12 px-2 sm:px-4">
          {hasForecasts ? (
            <section className="rounded-3xl bg-white/95 p-4 md:p-6 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-roboto font-semibold text-dark-grey">
                    Forecast Snapshot
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    Dialed for the next few hours
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-ocean-blue/5 to-white p-5 shadow-sm">
                    <div>
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ocean-blue/10">
                      <TideIcon className="h-8 w-8 text-ocean-blue" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-blue-100/40 to-white p-5 shadow-sm">
                    <div>
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ocean-blue/10">
                      <Wind className="h-8 w-8 text-ocean-blue" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-ocean-blue/10 bg-gradient-to-br from-blue-100/30 to-white p-5 shadow-sm">
                    <div>
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ocean-blue/10">
                      <Waves className="h-8 w-8 text-ocean-blue" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section id="live-cam" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-roboto font-semibold text-dark-grey">
                Live Cam
              </h2>
              <span className="text-sm text-muted-foreground">
                Watch the lineup in real time
              </span>
            </div>
            <CamsSection beachId={id} />
          </section>

          {hasForecasts ? (
            <section
              id="outlook"
              className="rounded-3xl bg-white/95 p-6 shadow-lg backdrop-blur"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-roboto font-semibold text-dark-grey">
                  5-Day Outlook
                </h2>
                <span className="text-sm text-muted-foreground">
                  Switch between tides, wind, swell, and week views
                </span>
              </div>
              {miniForecastDays.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>{label}</span>
                          <span className="text-[10px] uppercase text-ocean-blue/80">
                            {forecast.tide_status || "—"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-ocean-blue">
                            {formatMetric(forecast.wave_height)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ft
                          </span>
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
              ) : null}
              <div className="mt-6">
                <ForecastAndTides
                  beach={beach as Beach}
                  forecasts={forecasts || []}
                />
              </div>
            </section>
          ) : null}

          <section
            id="intel-section"
            className="rounded-3xl bg-white/95 p-4 md:p-6 shadow-lg backdrop-blur"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-xl font-roboto font-semibold text-dark-grey">
                <MessageSquare className="h-5 w-5 text-ocean-blue" /> Local
                Intel
              </h2>
              <span className="text-sm text-muted-foreground">
                Recent check-ins, crowd buzz, and surf notes
              </span>
            </div>
            <div id="intel" className="mt-4 scroll-mt-24">
              <BeachIntelSection
                beachId={id}
                beachName={beach.name}
                latitude={beach.latitude}
                longitude={beach.longitude}
                navigateOnViewAll={false}
                initialShowAll={searchParams?.get("show") === "all"}
              />
            </div>
          </section>

          <section id="reviews" className="space-y-6">
            <BeachReviewSummary
              beachId={beach.id}
              onWriteReview={handleWriteReview}
              refreshTrigger={reviewRefreshTrigger}
            />
            <BeachReviewsList
              beachId={beach.id}
              refreshTrigger={reviewRefreshTrigger}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <RecentSessionsSection beachId={id} />
            <CrowdTipsSection beachId={id} />
          </section>

          <section>
            <SpotOverview beach={beach as Beach} />
          </section>

          {sessionSnapshots && sessionSnapshots.length > 0 ? (
            <section className="rounded-3xl bg-white/95 p-6 shadow-lg backdrop-blur">
              <h2 className="text-xl font-roboto font-semibold text-dark-grey">
                Forecast Accuracy
              </h2>
              <div className="mt-4">
                <SessionForecastComparison
                  snapshots={sessionSnapshots}
                  maxItems={5}
                  className="bg-white/80 backdrop-blur-sm border-ocean-blue/20"
                />
              </div>
            </section>
          ) : null}
        </div>
      </main>

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

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Write a Review for {beach?.name}</DialogTitle>
          </DialogHeader>
          <BeachReviewForm
            beachId={id}
            beachName={beach?.name || ""}
            onSuccess={handleReviewSuccess}
            onCancel={() => setReviewDialogOpen(false)}
            isInDialog={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

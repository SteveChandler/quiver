"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
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
  () => import("@/components/intel/beach-intel-section").then((m) => m.BeachIntelSection),
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
  () => import("@/components/beach-detail/detailed-swell-modal").then((m) => m.DetailedSwellModal),
  { ssr: false }
);
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { MapPin, MessageSquare, Waves, Star } from "lucide-react";
import { SpotOverview } from "@/components/beach-detail/spot-overview";
import { FavoriteButton } from "@/components/favorite-button";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";
// Replacing BeachCheckIns with BeachIntelSection in Local Intel section
const ForecastAndTides = dynamic(
  () => import("@/components/beach-detail/forecast-and-tides").then((m) => m.ForecastAndTides),
  { ssr: false }
);
const BeachReviewSummary = dynamic(
  () => import("@/components/beach/beach-review-summary").then((m) => m.BeachReviewSummary),
  { ssr: false }
);
const BeachReviewsList = dynamic(
  () => import("@/components/beach/beach-reviews-list").then((m) => m.BeachReviewsList),
  { ssr: false }
);
const CamsSection = dynamic(
  () => import("@/components/beach-detail/cams-section").then((m) => m.CamsSection),
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
  () => import("@/components/beach-detail/crowd-tips-section").then((m) => m.CrowdTipsSection),
  { ssr: false }
);
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import { track, slugify } from "@/lib/analytics";

interface BeachDetailProps {
  id: string;
}

export function BeachDetail({ id }: BeachDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Persisted accordion open/closed sections (Spot Overview default open)
  const [openSections, setOpenSections] = useLocalStorageState<string[]>(
    `quiver:beach:${id}:sections`,
    ["forecast"]
  );

  // Handle URL parameters and default section opening
  useEffect(() => {
    // Prefer query param, fallback to hash
    const sectionParam = searchParams?.get("section");
    const hash = typeof window !== "undefined" ? window.location.hash : "";

    const wantsIntel = sectionParam === "intel" || hash === "#intel";

    if (wantsIntel) {
      // For intel deep-links, ensure intel is open (don't force forecast)
      if (!openSections.includes("intel")) {
        setOpenSections([...(openSections || []), "intel"]);
      }
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
    } else {
      // Only set forecast as default if no specific section is requested
      if (!openSections.includes("forecast")) {
        setOpenSections(["forecast", ...openSections]);
      }
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
    const beachData = (body as any)?.data?.beach || (body as any)?.beach || (body as any)?.data;
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
      throw new Error(body?.error || `Failed to fetch enhanced forecasts: ${res.status}`);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-blue" />
      </div>
    );
  }

  if (error || !forecasts || !beach) {
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

  const handleAccordionChange = (values: string | string[]) => {
    setOpenSections(Array.isArray(values) ? values : [values]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container flex items-center h-16 px-4 max-w-7xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/map")}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-roboto font-bold text-dark-grey">
            {beach.name}
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl md:text-4xl font-roboto font-extrabold mb-8 text-center bg-gradient-to-r from-ocean-blue to-blue-600 bg-clip-text text-transparent">
          {beach.name}
        </h1>

        {/* Quick actions: Favorite + Set Home Beach */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <FavoriteButton beachId={beach.id} variant="outline" size="sm" />
          <div className="w-48">
            <HomeBeachBanner selectedBeachId={beach.id} selectedBeachName={beach.name} />
          </div>
        </div>

        {/* Above the fold: Today → Next tides → Wind → Swell */}
        {forecasts && forecasts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Today</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div>Wave: {currentForecast?.wave_height ?? "–"}</div>
                <div>Period: {currentForecast?.wave_period ?? "–"}</div>
                <div>Cond: {currentForecast?.weather_condition ?? "–"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Next Tides</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div>Status: {currentForecast?.tide_status ?? "–"}</div>
                <div>
                  Next: {currentForecast?.next_tide_type ?? "–"} {currentForecast?.next_tide_height ?? ""} @ {currentForecast?.next_tide_time ?? ""}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Wind</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div>Speed: {currentForecast?.wind_speed ?? "–"}</div>
                <div>Dir: {currentForecast?.wind_direction ?? "–"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Swell</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div>Height: {currentForecast?.wave_height ?? "–"}</div>
                <div>Period: {currentForecast?.wave_period ?? "–"}</div>
                <div>Dir: {currentForecast?.wave_direction ?? "–"}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Accordion Sections */}
        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={handleAccordionChange}
          className="space-y-4"
        >
          {/* Forecast & Tides */}
          <AccordionItem value="forecast">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <Waves className="h-4 w-4" /> Forecast & Tides
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ForecastAndTides
                beach={beach as Beach}
                forecasts={forecasts || []}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 7-Day Chart */}
          <AccordionItem value="week">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <Waves className="h-4 w-4" /> 7-Day Outlook
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Tides and Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Reuse enhanced forecast with multi-day tide chart + table */}
                    {/* Keep client-only to avoid RSC overhead */}
                    {beach?.id && (
                      <div className="space-y-4">
                        {/* Lightweight multi-day: rely on ForecastAndTides internal tables/charts if available */}
                        {/* Or render enhanced forecast component for rich view */}
                        {/**/}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Local Intel */}
          <AccordionItem value="intel" id="intel-section">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Local Intel
              </span>
            </AccordionTrigger>
            <AccordionContent id="intel" className="scroll-mt-24">
              <BeachIntelSection
                beachId={id}
                beachName={beach.name}
                latitude={beach.latitude}
                longitude={beach.longitude}
                navigateOnViewAll={false}
                initialShowAll={searchParams?.get("show") === "all"}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Live Cams */}
          <AccordionItem value="cams">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-camera h-4 w-4"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Live Cams
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CamsSection beachId={id} />
            </AccordionContent>
          </AccordionItem>

          {/* Reviews */}
          <AccordionItem value="reviews">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4" /> Reviews
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6">
                <BeachReviewSummary
                  beachId={beach.id}
                  onWriteReview={handleWriteReview}
                  refreshTrigger={reviewRefreshTrigger}
                />
                <BeachReviewsList
                  beachId={beach.id}
                  refreshTrigger={reviewRefreshTrigger}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Recent Sessions */}
          <AccordionItem value="sessions">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar h-4 w-4"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>
                Recent Sessions
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <RecentSessionsSection beachId={id} />
            </AccordionContent>
          </AccordionItem>

          {/* Crowd Tips */}
          <AccordionItem value="tips">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users h-4 w-4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Crowd Tips
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CrowdTipsSection beachId={id} />
            </AccordionContent>
          </AccordionItem>

          {/* Spot Overview (moved last) */}
          <AccordionItem value="overview">
            <AccordionTrigger className="text-lg">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Spot Overview
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <SpotOverview beach={beach as Beach} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Forecast Accuracy Section */}
        {sessionSnapshots && sessionSnapshots.length > 0 && (
          <div className="space-y-6 mt-8">
            <h2 className="text-2xl md:text-3xl font-roboto font-bold bg-gradient-to-r from-ocean-blue to-blue-600 bg-clip-text text-transparent">
              Forecast Accuracy
            </h2>
            <SessionForecastComparison
              snapshots={sessionSnapshots}
              maxItems={5}
              className="bg-white/80 backdrop-blur-sm border-ocean-blue/20"
            />
          </div>
        )}

        {/* Detailed Swell Modal */}
        <DetailedSwellModal
          forecast={selectedDay ? forecastsByDate[selectedDay]?.[0] : null}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDay(null);
          }}
          selectedDate={selectedDay}
        />

        {/* Review Form Dialog */}
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
    </div>
  );
}

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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

import { TideChart } from "@/components/forecast/tide-chart-recharts";
import { BeachIntelSection } from "@/components/intel/beach-intel-section";
import { SessionForecastComparison } from "@/components/forecast/session-forecast-comparison";
import { DetailedSwellModal } from "@/components/beach-detail/detailed-swell-modal";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getBeachById } from "@/actions/beach/beach-query-actions";
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
// Replacing BeachCheckIns with BeachIntelSection in Local Intel section
import { ForecastAndTides } from "@/components/beach-detail/forecast-and-tides";
import { BeachReviewSummary } from "@/components/beach/beach-review-summary";
import { BeachReviewsList } from "@/components/beach/beach-reviews-list";
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

  // Fetch beach information
  const fetchBeach = useCallback(async () => {
    console.log("🏖️ Fetching beach data for:", id);
    const result = await getBeachById(id);
    if (result.success && result.data) {
      console.log("✅ Beach data:", result.data);
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch beach data");
  }, [id]);

  const {
    data: beach,
    loading: beachLoading,
    error: beachError,
  } = useDataFetcher(fetchBeach, {
    immediate: true,
  });

  // Single data fetch - 10-day enhanced forecast
  const fetchForecasts = useCallback(async () => {
    console.log("🚀 Starting fresh forecast fetch for beach:", id);
    const result = await getEnhancedBeachForecasts(id, 10);
    if (result.success && result.data) {
      console.log("🔍 Raw forecast data:", {
        totalForecasts: result.data.length,
        dateRange: {
          first: result.data[0]?.forecast_date,
          last: result.data[result.data.length - 1]?.forecast_date,
        },
        sampleForecast: result.data[0],
        uniqueDates: [...new Set(result.data.map((f) => f.forecast_date))],
        forecastsByDate: result.data.reduce((acc, f) => {
          acc[f.forecast_date] = (acc[f.forecast_date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch forecasts");
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

  // Track beach view once we have data
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

        {/* Quick actions: Favorite */}
        <div className="flex justify-end mb-4">
          <FavoriteButton beachId={beach.id} variant="outline" size="sm" />
        </div>

        {/* Today's Overview (compact metrics) */}
        {forecasts && forecasts.length > 0 && (
          <Card className="rounded-2xl shadow-xl mb-8 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-ocean-blue to-blue-600 text-white">
              <CardTitle className="text-xl md:text-2xl font-roboto font-bold">
                Today's Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-ocean-blue">Wave Height:</strong>{" "}
                <span className="text-ocean-blue/80">
                  {currentForecast?.wave_height || "Data Unavailable"}
                </span>
              </div>
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-ocean-blue">Wave Period:</strong>{" "}
                <span className="text-ocean-blue/80">
                  {currentForecast?.wave_period || "Data Unavailable"}
                </span>
              </div>
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-blue-700">Water Temp:</strong>{" "}
                <span className="text-blue-600">
                  {currentForecast?.water_temp}
                </span>
              </div>
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-blue-700">Wind Speed:</strong>{" "}
                <span className="text-blue-600">
                  {currentForecast?.wind_speed}
                </span>
              </div>
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-cyan-700">Wind Dir:</strong>{" "}
                <span className="text-cyan-600">
                  {currentForecast?.wind_direction}
                </span>
              </div>
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-cyan-700">Condition:</strong>{" "}
                <span className="text-cyan-600">
                  {currentForecast?.weather_condition}
                </span>
              </div>
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-teal-700">Tide Status:</strong>{" "}
                <span className="text-teal-600">
                  {currentForecast?.tide_status}
                </span>
              </div>
              <div className="bg-white/60 rounded-lg border p-3">
                <strong className="text-emerald-700">
                  Forecast window confidence:
                </strong>{" "}
                <span className="text-emerald-600">
                  {currentForecast
                    ? Math.round(currentForecast.confidence_score)
                    : "–"}
                  %
                </span>
              </div>
            </CardContent>
          </Card>
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

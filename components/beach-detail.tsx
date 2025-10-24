"use client";

import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CloudSun,
  Compass,
  MapPin,
  Navigation,
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
import { EnhancedBeachOverview } from "@/components/beach-detail/enhanced-beach-overview";
import { FavoriteButton } from "@/components/favorite-button";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";
import { ForecastFreshnessBadgeCompact } from "@/components/ui/forecast-freshness-badge";
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
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import { track, slugify } from "@/lib/analytics";
import { FullPageLoader } from "@/components/ui/loading-states";
import { getTodayDateString } from "@/lib/utils/forecast-ui-utils";

// New AllTrails-style components
import { BeachBreadcrumb } from "@/components/beach-detail/beach-breadcrumb";
import { BeachHeroCompact } from "@/components/beach-detail/beach-hero-compact";
import { BeachPhotoGallery } from "@/components/beach-detail/beach-photo-gallery";
import { BeachStatsGrid } from "@/components/beach-detail/beach-stats-grid";
import { BeachActions } from "@/components/beach-detail/beach-actions";
import { BeachTabs, BeachTabContent, type BeachTabValue } from "@/components/beach-detail/beach-tabs";
import { SessionPlanningModal } from "@/components/beach-detail/session-planning-modal";
import { TabLoadingSkeleton } from "@/components/beach-detail/tab-loading-skeleton";

// Tab content components - lazy loaded for better performance
const OverviewTab = lazy(() => import("@/components/beach-detail/tabs/overview-tab").then(m => ({ default: m.OverviewTab })));
const ForecastTab = lazy(() => import("@/components/beach-detail/tabs/forecast-tab").then(m => ({ default: m.ForecastTab })));
const ReviewsTab = lazy(() => import("@/components/beach-detail/tabs/reviews-tab").then(m => ({ default: m.ReviewsTab })));
const IntelTab = lazy(() => import("@/components/beach-detail/tabs/intel-tab").then(m => ({ default: m.IntelTab })));
const SessionsTab = lazy(() => import("@/components/beach-detail/tabs/sessions-tab").then(m => ({ default: m.SessionsTab })));

interface BeachDetailProps {
  id: string;
  publicMode?: boolean;
  initialBeach?: Beach;
}

export function BeachDetail({
  id,
  publicMode = false,
  initialBeach,
}: BeachDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedForecastEntry, setSelectedForecastEntry] =
    useState<EnhancedForecastEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionPlanningOpen, setSessionPlanningOpen] = useState(false);
  const [sessionPlanningMode, setSessionPlanningMode] = useState<"log" | "plan">("log");
  const [activeTab, setActiveTab] = useState<BeachTabValue>("overview");

  // Handle URL parameters and default section opening
  useEffect(() => {
    // Prefer query param, fallback to hash
    const sectionParam = searchParams?.get("section");
    const hash = typeof window !== "undefined" ? window.location.hash : "";

    const wantsIntel = sectionParam === "intel" || hash === "#intel";

    if (wantsIntel) {
      // Switch to intel tab for deep-linking
      setActiveTab("intel");

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
    if (process.env.NODE_ENV === "development") {
      console.log("🏖️ Fetching beach data (API) for:", id);
    }
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
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Beach data:", beachData);
    }
    return beachData as Beach;
  }, [id]);

  const {
    data: beach,
    loading: beachLoading,
    error: beachError,
  } = useDataFetcher(fetchBeach, {
    immediate: !initialBeach,
    initialData: initialBeach,
  });

  // Single data fetch - 10-day enhanced forecast via API
  const fetchForecasts = useCallback(async () => {
    if (process.env.NODE_ENV === "development") {
      console.log("🚀 Starting enhanced forecast fetch (API) for beach:", id);
    }
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
    if (process.env.NODE_ENV === "development") {
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
    }
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

  // Determine if this beach has a live camera available
  const fetchSources = useCallback(async () => {
    const res = await fetch(`/api/beaches/${id}/sources`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return (body as any)?.data?.sources || (body as any)?.sources || null;
  }, [id]);

  const { data: sources } = useDataFetcher(fetchSources, { immediate: true });

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

    if (process.env.NODE_ENV === "development") {
      console.log("🏖️ Beach Detail currentForecast selection:", {
        totalForecasts: forecasts.length,
        selectedTime: selectedForecast?.forecast_time,
        selectedWaveHeight: selectedForecast?.wave_height,
        firstForecastTime: forecasts[0]?.forecast_time,
        firstForecastWaveHeight: forecasts[0]?.wave_height,
        isClient: typeof window !== "undefined",
      });
    }

    return selectedForecast;
  }, [forecasts]);

  // Process data for display - memoized to prevent unnecessary recalculations
  const forecastsByDate = useMemo(() => {
    const grouped: Record<string, EnhancedForecastEntity[]> = {};

    if (forecasts && Array.isArray(forecasts) && forecasts.length > 0) {
      if (process.env.NODE_ENV === "development") {
        console.log("📊 Processing forecasts:", {
          totalForecasts: forecasts.length,
          firstForecast: forecasts[0],
        });
      }

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

      if (process.env.NODE_ENV === "development") {
        console.log("📅 Grouped forecasts by date:", {
          dates: Object.keys(grouped),
          forecastsPerDate: Object.entries(grouped).map(
            ([date, forecasts]) => ({
              date,
              count: forecasts.length,
              firstForecast: forecasts[0]?.wave_height,
            })
          ),
        });
      }
    }

    return grouped;
  }, [forecasts]);

  // Get the first day's forecast for overview
  const sortedDates = useMemo(
    () => Object.keys(forecastsByDate).sort(),
    [forecastsByDate]
  );

  const miniForecastDays = useMemo(() => {
    const today = getTodayDateString();
    return sortedDates
      .filter((date) => date >= today) // Only show today and future dates
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
  const hasCamera = Boolean((sources as any)?.camera_url);

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

  // Session planning handlers
  const handlePlanSession = () => {
    setSessionPlanningMode("plan");
    setSessionPlanningOpen(true);
  };

  const handleLogSession = () => {
    setSessionPlanningMode("log");
    setSessionPlanningOpen(true);
  };

  const destinationCoordinates =
    beach?.latitude && beach?.longitude
      ? `${beach.latitude},${beach.longitude}`
      : null;
  const canGetDirections = Boolean(destinationCoordinates);

  const handleGetDirections = useCallback(() => {
    if (!destinationCoordinates) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationCoordinates}`;
    window.open(url, "_blank", "noopener");
  }, [destinationCoordinates]);

  const tabActions = (
    <>
      <Button
        variant="outline"
        onClick={handleGetDirections}
        disabled={!canGetDirections}
        className="h-10 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Navigation className="mr-2 h-4 w-4" />
        Get directions
      </Button>
      <FavoriteButton
        beachId={beach.id}
        variant="outline"
        className="h-10 border-gray-300 text-gray-700 hover:bg-gray-50"
      />
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50/30 to-white">
      {/* Main Content Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Breadcrumb Navigation */}
        <BeachBreadcrumb beach={beach} className="mb-4" />

        {/* Compact Hero - Title, Rating, Difficulty, Location */}
        <BeachHeroCompact beach={beach as any} className="mb-6" />

        {/* Photo Gallery with Map */}
        <BeachPhotoGallery beach={beach} className="mb-6" />

        {/* Key Stats Grid */}
        <BeachStatsGrid
          beach={beach}
          currentForecast={currentForecast}
          className="mb-6"
        />

        {/* Action Buttons */}
        <BeachActions
          beach={beach}
          onPlanSession={handlePlanSession}
          onLogSession={handleLogSession}
          onGetDirections={handleGetDirections}
          canGetDirections={canGetDirections}
          className="mb-8"
        />

        {/* Tabbed Content */}
        <BeachTabs activeTab={activeTab} onTabChange={setActiveTab} actions={tabActions}>
          {/* Overview Tab */}
          <BeachTabContent value="overview">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <OverviewTab beach={beach as any} />
            </Suspense>
          </BeachTabContent>

          {/* Forecast Tab */}
          <BeachTabContent value="forecast">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <ForecastTab
                beach={beach}
                forecasts={forecasts || []}
                currentForecast={currentForecast}
                hasCamera={hasCamera}
              />
            </Suspense>
          </BeachTabContent>

          {/* Reviews Tab */}
          <BeachTabContent value="reviews">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <ReviewsTab
                beach={beach}
                onWriteReview={handleWriteReview}
                reviewRefreshTrigger={reviewRefreshTrigger}
              />
            </Suspense>
          </BeachTabContent>

          {/* Local Intel Tab */}
          <BeachTabContent value="intel">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <IntelTab
                beach={beach}
                initialShowAll={searchParams?.get("show") === "all"}
              />
            </Suspense>
          </BeachTabContent>

          {/* Sessions Tab */}
          <BeachTabContent value="sessions">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <SessionsTab
                beach={beach}
                sessionSnapshots={sessionSnapshots}
              />
            </Suspense>
          </BeachTabContent>
        </BeachTabs>
      </div>

      {/* Public Mode Content Gate - Wrap entire content if in public mode */}
      {publicMode && (
        <PublicContentGate
          ctaTitle="Join Quiver to see full conditions"
          ctaDescription="Get detailed forecasts, tides, reviews, local intel, and connect with the surf community"
          blurLevel="lg"
          source="beach-detail"
          className="min-h-[800px]"
        />
      )}

      {/* Session Planning Modal */}
      <SessionPlanningModal
        open={sessionPlanningOpen}
        onOpenChange={setSessionPlanningOpen}
        beach={beach}
        initialMode={sessionPlanningMode}
      />

      {/* Review Dialog */}
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

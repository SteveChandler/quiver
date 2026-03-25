"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Navigation, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useBeachDetailData } from "@/hooks/use-beach-detail-data";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getYesterdayAccuracy } from "@/actions/accuracy-actions";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { BeachAlertCta } from "@/components/beach-detail/beach-alert-cta";
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import {
  REVIEW_TRACKING_SOURCES,
  type ReviewTrackingSource,
} from "@/lib/constants/review-tracking";
import { track } from "@/lib/analytics";
import { useTrackEvent } from "@/hooks/use-track-event";
import { slugify } from "@/lib/utils/text-utils";
import { buildCamEmbed } from "@/lib/media/cam-embed";
import { FullPageLoader } from "@/components/ui/loading-states";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";

// New AllTrails-style components
import { BeachBreadcrumb } from "@/components/beach-detail/beach-breadcrumb";
import { BeachHeroCompact } from "@/components/beach-detail/beach-hero-compact";
import { BeachPhotoGallery } from "@/components/beach-detail/beach-photo-gallery";
import { BeachStatsGrid } from "@/components/beach-detail/beach-stats-grid";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import { BeachActions } from "@/components/beach-detail/beach-actions";
import {
  BeachTabs,
  BeachTabContent,
  type BeachTabValue,
} from "@/components/beach-detail/beach-tabs";
import { SessionPlanningModal } from "@/components/beach-detail/session-planning-modal";
import { TabLoadingSkeleton } from "@/components/beach-detail/tab-loading-skeleton";
// InlineSignupCta and MatchScoreTeaser removed — Phase 1A CTA reduction.
// The hero forecast teaser in BeachHeroCompact is now the sole CTA for anonymous users.
import { TrustStrip } from "@/components/beach-detail/trust-strip";
import { ForecastConfidenceBadge } from "@/components/beach-detail/forecast-confidence-badge";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { aggregateDayForecasts } from "@/lib/utils/horizon-strip-utils";
// trackSignupCtaClick, trackAuthModalOpened, and motion removed — only needed for removed CTAs

// PERFORMANCE OPTIMIZATION: Lazy load tab content to reduce initial bundle size
// Only load the active tab's code on-demand
const OverviewTab = lazy(() =>
  import("@/components/beach-detail/tabs/overview-tab").then((m) => ({
    default: m.OverviewTab,
  })),
);
const ForecastTab = lazy(() =>
  import("@/components/beach-detail/tabs/forecast-tab").then((m) => ({
    default: m.ForecastTab,
  })),
);
const ReviewsTab = lazy(() =>
  import("@/components/beach-detail/tabs/reviews-tab").then((m) => ({
    default: m.ReviewsTab,
  })),
);
const IntelTab = lazy(() =>
  import("@/components/beach-detail/tabs/intel-tab").then((m) => ({
    default: m.IntelTab,
  })),
);
const SessionsTab = lazy(() =>
  import("@/components/beach-detail/tabs/sessions-tab").then((m) => ({
    default: m.SessionsTab,
  })),
);

// Dynamic import for cam player (no SSR — uses browser-only HLS)
const CamsSection = lazy(() =>
  import("@/components/beach-detail/cams-section").then((m) => ({
    default: m.CamsSection,
  })),
);

// Constants to prevent unnecessary re-renders
const EMPTY_FORECASTS: EnhancedForecastEntity[] = [];

interface BeachDetailProps {
  id: string;
  publicMode?: boolean;
  initialBeach?: Beach;
  beachTimezone?: string | null;
  surfReportSlot?: ReactNode;
  surfCallReport?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;
  defaultTab?: "overview" | "forecast" | "reviews" | "intel" | "sessions";
  defaultSubTab?: "today" | "tides" | "conditions";
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  personalizationData?: {
    score:
      | import("@/lib/services/personalized-scoring-service").PersonalizedScore
      | null;
    affinityData: { sessionCount: number; lastSurfed: Date } | null;
    isLoading: boolean;
    error: boolean;
  };
  onPersonalizationRequest?: (
    forecast: EnhancedForecastEntity,
    baseScore: number,
  ) => void;
}

function BeachDetailContent({
  id,
  publicMode = false,
  initialBeach,
  beachTimezone,
  surfReportSlot,
  surfCallReport,
  surfCallIsTomorrow,
  defaultTab,
  defaultSubTab,
  amenities,
  waterQuality,
  personalizationData,
  onPersonalizationRequest,
}: BeachDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDialogSource, setReviewDialogSource] =
    useState<ReviewTrackingSource>(REVIEW_TRACKING_SOURCES.OVERVIEW_CTA);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedForecastEntry, setSelectedForecastEntry] =
    useState<EnhancedForecastEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionPlanningOpen, setSessionPlanningOpen] = useState(false);
  const [sessionPlanningMode, setSessionPlanningMode] = useState<
    "log" | "plan"
  >("log");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BeachTabValue>(
    defaultTab || "forecast",
  );
  const { track: trackEvent } = useTrackEvent();

  // Track whether we've already synced the tab from URL params
  // If defaultTab is provided (e.g., from tides/water-temp pages), mark as synced
  const [tabSynced, setTabSynced] = useState(!!defaultTab);

  // Handle URL parameters and default section opening
  useEffect(() => {
    // Only sync tab from URL once on mount
    if (tabSynced) return;

    // Wait for searchParams to be available (Suspense boundary resolves)
    if (!searchParams) return;

    // Check for explicit tab param first
    const tabQueryParam = searchParams.get("tab");
    if (
      tabQueryParam &&
      ["overview", "forecast", "reviews", "intel", "sessions"].includes(
        tabQueryParam,
      )
    ) {
      setActiveTab(tabQueryParam as BeachTabValue);
      setTabSynced(true);
      return;
    }

    // Prefer query param, fallback to hash for legacy intel deep-linking
    const sectionParam = searchParams.get("section");
    const hash = typeof window !== "undefined" ? window.location.hash : ""; // eslint-disable-line no-restricted-properties

    const wantsIntel = sectionParam === "intel" || hash === "#intel";

    if (wantsIntel) {
      // Switch to intel tab for deep-linking
      setActiveTab("intel");
      setTabSynced(true);

      // Scroll into view after layout settles, accounting for sticky header
      const stickyOffset = 80; // px; header + spacing
      setTimeout(() => {
        const el =
          document.getElementById("intel") ||
          document.getElementById("intel-section");
        if (el) {
          try {
            // Update URL hash without navigation
            const qs = searchParams.toString() || "";
            const nextUrl = qs
              ? `${pathname}?${qs}#intel`
              : `${pathname}#intel`;
            router.replace(nextUrl, { scroll: false });
          } catch {}
          const y =
            el.getBoundingClientRect().top + window.scrollY - stickyOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 120);
    } else {
      setTabSynced(true);
    }
  }, [searchParams, tabSynced, pathname, router]);

  // PERFORMANCE OPTIMIZATION: Fetch all data in parallel (beach, forecasts, sources)
  // This eliminates the waterfall pattern and dramatically improves load time
  const {
    beach,
    forecasts = EMPTY_FORECASTS,
    sources,
    loading,
    errors,
    refetch,
  } = useBeachDetailData({
    beachId: id,
    initialBeach,
    forecastDays: 10,
  });

  // Fetch forecast calibration data
  const { sessionSnapshots } = useForecastCalibration({ beachId: id });

  // Fetch yesterday's accuracy data
  const fetchAccuracy = useCallback(async () => {
    return await getYesterdayAccuracy(id);
  }, [id]);
  const { data: yesterdayAccuracy } = useDataFetcher(fetchAccuracy);

  // Review handlers
  const handleWriteReview = useCallback(
    (source: ReviewTrackingSource = REVIEW_TRACKING_SOURCES.OVERVIEW_CTA) => {
      setReviewDialogSource(source);
      setReviewDialogOpen(true);
    },
    [],
  );

  const handleReviewSuccess = useCallback(() => {
    setReviewDialogOpen(false);
    setReviewRefreshTrigger((prev) => prev + 1);
  }, []);

  // Combined error states - only beach errors are fatal
  const error = errors.beach;

  // Log non-fatal errors
  useEffect(() => {
    if (errors.forecasts) {
      console.warn("Forecast data unavailable:", errors.forecasts);
    }
    if (errors.sources) {
      console.warn("Source data unavailable:", errors.sources);
    }
  }, [errors.forecasts, errors.sources]);

  // Track beach view once we have data
  // Note: Hooks must run unconditionally on every render (before any return)
  useEffect(() => {
    if (!beach) return;
    try {
      const isHome = (searchParams?.get("from") || "") === "home";
      // GA4 tracking
      track("beach_view", {
        beach_slug: slugify(beach.name),
        region: beach.region || getBeachLocation(beach) || undefined,
        is_home: isHome,
      });
      // Supabase user_events tracking (works for both authed and anon)
      trackEvent("beach_view", {
        beachId: beach.id,
        metadata: {
          referrer: isHome ? "home" : document.referrer || undefined,
        },
      });
    } catch {}
    // only on first load per beach id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beach?.id]);

  // Select the best forecast using the same time-aware logic as home page
  const currentForecast = useMemo(() => {
    if (!forecasts || forecasts.length === 0) return null;

    // Use the same getCurrentForecast utility as the home page for consistency
    const selectedForecast = getCurrentForecast(forecasts);

    if (process.env.NODE_ENV === "development") {
      console.warn("Beach Detail currentForecast selection:", {
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

  // Request personalization when forecast data is available
  useEffect(() => {
    if (
      !publicMode &&
      onPersonalizationRequest &&
      currentForecast &&
      beach?.base_score &&
      !personalizationData?.score &&
      !personalizationData?.isLoading
    ) {
      onPersonalizationRequest(currentForecast, beach.base_score);
    }
  }, [
    publicMode,
    onPersonalizationRequest,
    currentForecast,
    beach?.base_score,
    personalizationData?.score,
    personalizationData?.isLoading,
  ]);

  const showCamHero =
    Boolean(sources?.camera_url) &&
    buildCamEmbed(sources?.camera_url).kind !== "none";

  // Horizon strip data for the hero teaser copy (firstHiddenDayName, peakHiddenWaveHeight)
  const horizonDaySummaries = useMemo(() => {
    if (!publicMode || !forecasts.length || !beach) return [];
    return aggregateDayForecasts(forecasts, beach, {
      maxDays: 12,
      timezone: beachTimezone || undefined,
    });
  }, [publicMode, forecasts, beach, beachTimezone]);

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

  // Peak wave height across the hidden days (4-12) for data-driven teaser copy
  const peakHiddenWaveHeight = useMemo(() => {
    if (!publicMode || horizonDaySummaries.length <= 3) return null;
    const hiddenDays = horizonDaySummaries.slice(3);
    const maxHeight = Math.max(...hiddenDays.map(d => d.maxHeight ?? 0).filter(h => h > 0));
    return maxHeight > 0 ? maxHeight : null;
  }, [publicMode, horizonDaySummaries]);

  // Calculate destination coordinates and directions handler BEFORE early returns
  // (must be before early returns to maintain consistent hook count)
  const destinationCoordinates =
    beach?.lat && beach?.lon ? `${beach.lat},${beach.lon}` : null;
  const canGetDirections = Boolean(destinationCoordinates);

  const handleGetDirections = useCallback(() => {
    if (!destinationCoordinates) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationCoordinates}`;
    window.open(url, "_blank", "noopener");
  }, [destinationCoordinates]);

  const handleAuthRequired = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  // PERFORMANCE OPTIMIZATION: Progressive rendering
  // Show hero section immediately with beach data, load tab content progressively
  // Only show full page loader if we don't have beach data yet
  if (loading && !beach) {
    return <FullPageLoader />;
  }

  // After loading finishes, show error only if we truly have an error or no beach
  if (error || !beach) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        {/* Breadcrumb Navigation in Error State */}
        <nav aria-label="Breadcrumb" className="px-4 py-3 bg-white border-b">
          <div className="max-w-6xl mx-auto">
            <Link
              href="/map"
              className="text-ocean-blue hover:underline text-sm font-medium"
            >
              ← Back to Map
            </Link>
          </div>
        </nav>

        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <h2 className="text-xl font-heading font-bold mb-2 text-dark-grey">
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
      </div>
    );
  }

  // Track if tab data is still loading (for skeleton loaders)
  const tabDataLoading = loading;

  // Session planning handlers
  const handlePlanSession = () => {
    setSessionPlanningMode("plan");
    setSessionPlanningOpen(true);
  };

  const handleLogSession = () => {
    setSessionPlanningMode("log");
    setSessionPlanningOpen(true);
  };

  const tabActions = (
    <>
      <Button
        variant="ghost"
        onClick={handleGetDirections}
        disabled={!canGetDirections}
        className="flex-1 rounded-none border-0 border-b-2 border-transparent -mb-0.5 px-2 py-2 sm:px-6 sm:py-3 text-xs sm:text-base font-medium text-gray-600 transition-all duration-300 ease-out hover:bg-gray-50 dark:hover:bg-[#354090]/50 hover:text-gray-900 h-auto"
      >
        <Navigation className="mr-2 h-4 sm:h-5 w-4 sm:w-5" />
        <span className="hidden sm:inline">Get directions</span>
        <span className="sm:hidden">Directions</span>
      </Button>
      <BeachAlertCta
        beachId={beach.id}
        beachName={beach.name}
        compact
        className="flex-1 bg-transparent shadow-none rounded-none border-0 border-b-2 border-transparent -mb-0.5 px-2 py-2 sm:px-6 sm:py-3 text-xs sm:text-base font-medium text-gray-600 transition-all duration-300 ease-out hover:bg-gray-50 dark:hover:bg-[#354090]/50 hover:text-gray-900 h-auto"
      />
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50/30 to-white">
      {/* Immersive hero: video or photos background with title at top and forecast at bottom */}
      <div className="relative mb-6 min-h-[280px] md:min-h-[400px]">
        {showCamHero ? (
          /* Live cam stream — ungated for all users */
          <Suspense
            fallback={
              <div
                className="aspect-video w-full"
                style={{ backgroundColor: "#2D357D" }}
              />
            }
          >
            <CamsSection sources={sources} variant="hero" />
          </Suspense>
        ) : (
          /* Photo gallery background */
          <BeachPhotoGallery beach={beach} className="w-full" />
        )}

        {/* Top gradient — darkens top for title readability */}
        <div
          className="absolute inset-x-0 top-0 h-1/3 pointer-events-none z-[5]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(11,20,38,0.7) 0%, rgba(11,20,38,0.3) 60%, transparent 100%)",
          }}
        />

        {/* Bottom gradient — darkens bottom for forecast readability (hidden when cam is active) */}
        {!showCamHero && (
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none z-[5]"
            style={{
              background:
                "linear-gradient(to top, #252D6B 0%, rgba(37,45,107,0.85) 30%, rgba(37,45,107,0.3) 65%, transparent 100%)",
            }}
          />
        )}

        {/* Title — top of hero */}
        <div className="absolute inset-x-0 top-0 px-4 sm:px-6 pt-6 z-[6]">
          <div className="mx-auto max-w-7xl">
            <BeachBreadcrumb beach={beach} className="mb-1" />
            <h1
              className="font-heading text-4xl sm:text-5xl font-bold text-white leading-tight"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7)" }}
            >
              {beach.name} Surf Report
            </h1>
          </div>
        </div>

        {/* Forecast overlay — bottom of hero (hidden when cam video is playing) */}
        {!showCamHero && (
          <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4 z-[6]">
            <div className="mx-auto max-w-7xl">
              <BeachHeroCompact
                beach={beach as any}
                publicMode={publicMode}
                personalizationScore={personalizationData?.score}
                affinityData={personalizationData?.affinityData}
                baseScore={beach.base_score}
                isLoadingPersonalization={personalizationData?.isLoading}
                currentForecast={currentForecast}
                overlayMode={true}
                firstHiddenDayName={firstHiddenDayName}
                peakHiddenWaveHeight={peakHiddenWaveHeight}
              />
              {currentForecast && (
                <ConditionsTicker
                  data={forecastToConditionsData(currentForecast, beach)}
                  theme="dark"
                  beachName={beach.name}
                  showFrequency
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Surf report slot — authenticated users only */}
        {!publicMode && surfReportSlot}

        {/* Key Stats Grid */}
        <BeachStatsGrid
          beach={beach}
          currentForecast={currentForecast}
          className="mb-6"
        />

        {/* Action Buttons */}
        <BeachActions
          beach={beach}
          onGetDirections={handleGetDirections}
          canGetDirections={canGetDirections}
          publicMode={publicMode}
          onAuthRequired={handleAuthRequired}
          className="mb-8"
        />

        {/* Forecast Error Warning Banner */}
        {errors.forecasts && (
          <Alert className="border-amber-200/70 bg-amber-50 text-amber-900 mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Forecast data is temporarily unavailable. Some information may be
              missing.
            </AlertDescription>
          </Alert>
        )}

        {/* Horizon strip upsell removed — Phase 1A CTA reduction.
            The hero forecast teaser is now the sole anonymous CTA. */}

        {/* Trust Strip + Confidence Badge — credibility signals for anonymous visitors */}
        <TrustStrip />
        <div className="mb-4">
          <ForecastConfidenceBadge />
        </div>

        {/* Tabbed Content */}
        <BeachTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          actions={tabActions}
          publicMode={publicMode}
        >
          {/* Overview Tab */}
          <BeachTabContent value="overview">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <OverviewTab
                beach={beach as any}
                amenities={amenities}
                waterQuality={waterQuality}
                onWriteReview={() =>
                  handleWriteReview(REVIEW_TRACKING_SOURCES.OVERVIEW_CTA)
                }
              />
            </Suspense>
            {/* Top-level CTA already visible for anonymous users — no duplicate needed here */}
          </BeachTabContent>

          {/* Forecast Tab */}
          <BeachTabContent value="forecast">
            {tabDataLoading ? (
              <TabLoadingSkeleton />
            ) : (
              <Suspense fallback={<TabLoadingSkeleton />}>
                <ForecastTab
                  beach={beach}
                  beachTimezone={beachTimezone}
                  forecasts={forecasts || []}
                  currentForecast={currentForecast}
                  surfCall={surfCallReport}
                  surfCallIsTomorrow={surfCallIsTomorrow}
                  defaultSubTab={defaultSubTab}
                  publicMode={publicMode}
                  yesterdayAccuracy={yesterdayAccuracy}
                />
              </Suspense>
            )}
          </BeachTabContent>

          {/* Reviews Tab */}
          <BeachTabContent value="reviews">
            {tabDataLoading ? (
              <TabLoadingSkeleton />
            ) : (
              <Suspense fallback={<TabLoadingSkeleton />}>
                <ReviewsTab
                  beach={beach}
                  onWriteReview={() =>
                    handleWriteReview(REVIEW_TRACKING_SOURCES.REVIEWS_TAB)
                  }
                  reviewRefreshTrigger={reviewRefreshTrigger}
                  publicMode={publicMode}
                  previewCount={3}
                />
              </Suspense>
            )}
          </BeachTabContent>

          {/* Local Intel Tab */}
          <BeachTabContent value="intel">
            {tabDataLoading ? (
              <TabLoadingSkeleton />
            ) : (
              <Suspense fallback={<TabLoadingSkeleton />}>
                <IntelTab
                  beach={beach}
                  initialShowAll={searchParams?.get("show") === "all"}
                  publicMode={publicMode}
                  previewCount={1}
                />
              </Suspense>
            )}
          </BeachTabContent>

          {/* Sessions Tab */}
          <BeachTabContent value="sessions">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <SessionsTab
                beach={beach}
                sessionSnapshots={sessionSnapshots}
                publicMode={publicMode}
                previewCount={2}
              />
            </Suspense>
          </BeachTabContent>
        </BeachTabs>
      </div>

      {/* Session Planning Modal */}
      <SessionPlanningModal
        open={sessionPlanningOpen}
        onOpenChange={setSessionPlanningOpen}
        beach={beach}
        initialMode={sessionPlanningMode}
      />

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>Write a Review for {beach?.name}</DialogTitle>
          </DialogHeader>
          <BeachReviewForm
            beachId={id}
            beachName={beach?.name || ""}
            onSuccess={handleReviewSuccess}
            onCancel={() => setReviewDialogOpen(false)}
            isInDialog={true}
            trackingSource={reviewDialogSource}
          />
        </DialogContent>
      </Dialog>

      {/* Auth Modal for unauthenticated action button clicks */}
      {publicMode && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source="beach-action-buttons"
        />
      )}
    </div>
  );
}

// Wrap BeachDetailContent in Suspense to support useSearchParams() during static generation
export function BeachDetail(props: BeachDetailProps) {
  return (
    <Suspense fallback={<FullPageLoader text="Loading beach details..." />}>
      <BeachDetailContent {...props} />
    </Suspense>
  );
}

"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Waves, Thermometer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useAuth } from "@/context/auth-context";
import { useBeachDetailData } from "@/hooks/use-beach-detail-data";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getYesterdayAccuracy } from "@/actions/accuracy-actions";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import {
  REVIEW_TRACKING_SOURCES,
  type ReviewTrackingSource,
} from "@/lib/constants/review-tracking";
import { track } from "@/lib/analytics";
import { useTrackEvent } from "@/hooks/use-track-event";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import { slugify } from "@/lib/utils/text-utils";
import { FullPageLoader } from "@/components/ui/loading-states";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { ZineBeachPhoto } from "@/components/beach-detail/zine/types";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import type { ZineHeroHeadingLevel } from "@/components/beach-detail/zine/zine-hero";

// New AllTrails-style components
import { BeachBreadcrumb } from "@/components/beach-detail/beach-breadcrumb";
import { BeachHeroCompact } from "@/components/beach-detail/beach-hero-compact";
import { BeachAttributionCluster } from "@/components/beach-detail/beach-attribution-cluster";
import { BeachPhotoGallery } from "@/components/beach-detail/beach-photo-gallery";
import { BeachStatsGrid } from "@/components/beach-detail/beach-stats-grid";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import { BeachAlertCta } from "@/components/beach-detail/beach-alert-cta";
import {
  BeachTabs,
  BeachTabContent,
  type BeachTabValue,
} from "@/components/beach-detail/beach-tabs";
import { ZinePageShell } from "@/components/beach-detail/zine/zine-page-shell";
import { TabLoadingSkeleton } from "@/components/beach-detail/tab-loading-skeleton";
// InlineSignupCta stays removed — Phase 1A CTA reduction.
// MatchScoreTeaser was removed in Phase 1A but reinstated 2026-04-28 based
// on lifetime CTR data — it was the strongest-performing high-volume CTA in
// the system (1.07% over 1,305 views vs ~0% for the gates that replaced it).
import { MatchScoreTeaser } from "@/components/recommendations";
import { TrustStrip } from "@/components/beach-detail/trust-strip";
import { ForecastConfidenceBadge } from "@/components/beach-detail/forecast-confidence-badge";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { aggregateDayForecasts } from "@/lib/utils/horizon-strip-utils";
import { AlertCreationPopover } from "@/components/alerts/alert-creation-popover";
import { AnonAlertCaptureForm } from "@/components/alerts/anon-alert-capture-form";
import type { BeachAlertMeta } from "@/lib/alerts/types";
import { CommunityPhotoUpload } from "@/components/media/community-photo-upload";
// trackSignupCtaClick, trackAuthModalOpened, and motion removed — only needed for removed CTAs

// Alert discoverability nudge — shows for favorited beaches with no alert rules
function AlertNudge({
  beachId,
  beachName,
  onSetupAlerts,
}: {
  beachId: string;
  beachName: string;
  onSetupAlerts: () => void;
}) {
  const { user } = useAuth();

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(`alert-nudge-dismissed-${beachId}`) === "true";
  });

  const fetchFavorited = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const res = await fetch("/api/beaches/favorites", {
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => ({}));
    const beaches: Array<{ id: string }> =
      body?.data?.beaches || body?.beaches || [];
    return beaches.some((b) => b.id === beachId);
  }, [user, beachId]);

  const { data: isFavorited } = useDataFetcher(fetchFavorited, {
    skip: !user || dismissed,
    initialData: false,
  });

  const fetchAlertRules = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    const res = await fetch("/api/alerts/rules");
    if (!res.ok) return 0;
    const json = await res.json();
    const rules: Array<{ beach_id: string }> = json.data ?? [];
    return rules.filter((r) => r.beach_id === beachId).length;
  }, [user, beachId]);

  const { data: ruleCount } = useDataFetcher(fetchAlertRules, {
    skip: !user || dismissed,
    initialData: 0,
  });

  if (!user || dismissed || !isFavorited || (ruleCount ?? 0) > 0) return null;

  const dismiss = () => {
    localStorage.setItem(`alert-nudge-dismissed-${beachId}`, "true");
    setDismissed(true);
  };

  return (
    <aside className="mx-auto mb-6 hidden max-w-5xl border-y-2 border-[#11100D] bg-[#E8DCC0] px-0 py-3 text-[#11100D] shadow-[0_3px_0_rgba(17,16,13,0.16)] md:block">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 px-1 sm:px-0">
          <span className="inline-flex h-9 w-9 shrink-0 rotate-[-2deg] items-center justify-center border-2 border-[#11100D] bg-[#F78E42] text-[#11100D] shadow-[2px_2px_0_#11100D]">
            <Waves className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-[var(--font-mono)] text-[10px] font-black uppercase tracking-[0.18em] text-[#5F5646]">
              Condition watch
            </span>
            <span className="block text-sm font-semibold leading-5 text-[#11100D]">
              Track ideal windows at {beachName}.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 px-1 sm:ml-3 sm:px-0">
          <button
            onClick={onSetupAlerts}
            className="inline-flex min-h-9 items-center border-2 border-[#11100D] bg-[#F78E42] px-3 font-[var(--font-mono)] text-[11px] font-black uppercase tracking-[0.12em] text-[#11100D] shadow-[2px_2px_0_#11100D] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8DCC0]"
          >
            Set up alert
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="inline-flex h-9 w-9 items-center justify-center text-[#5F5646] transition hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

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

// Constants to prevent unnecessary re-renders
const EMPTY_FORECASTS: EnhancedForecastEntity[] = [];

function getClosestForecastToNow(
  forecasts: EnhancedForecastEntity[],
): EnhancedForecastEntity | null {
  if (!forecasts || forecasts.length === 0) return null;

  const withForecastAt = forecasts.filter((forecast) => forecast.forecast_at);
  if (withForecastAt.length === 0) {
    return getCurrentForecast(forecasts);
  }

  const nowMs = Date.now();
  return withForecastAt.reduce((closest, forecast) => {
    const closestDiff = Math.abs(
      new Date(closest.forecast_at).getTime() - nowMs,
    );
    const forecastDiff = Math.abs(
      new Date(forecast.forecast_at).getTime() - nowMs,
    );
    return forecastDiff < closestDiff ? forecast : closest;
  });
}

interface BeachDetailProps {
  id: string;
  publicMode?: boolean;
  initialBeach?: Beach;
  beachTimezone?: string | null;
  surfCallReport?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;
  defaultTab?: "overview" | "forecast" | "reviews" | "intel" | "sessions";
  defaultSubTab?: "today" | "tides" | "conditions";
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  beachPhoto?: ZineBeachPhoto | null;
  heroHeadingLevel?: ZineHeroHeadingLevel;
  heroHeadingSuffix?: string;
  heroSummarySlot?: ReactNode;
  heroForecastSlot?: ReactNode;
  beforeTabsContent?: ReactNode;
  afterTabsContent?: ReactNode;
  freeGrowthPhaseEnabled?: boolean;
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
  surfCallReport,
  surfCallIsTomorrow,
  defaultTab,
  defaultSubTab,
  amenities,
  waterQuality,
  beachPhoto,
  heroHeadingLevel,
  heroHeadingSuffix,
  heroSummarySlot,
  heroForecastSlot,
  beforeTabsContent,
  afterTabsContent,
  freeGrowthPhaseEnabled = false,
  personalizationData,
  onPersonalizationRequest,
}: BeachDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useAuth();

  // US beach pages have 3-segment paths starting with a 2-letter state code (e.g., /ca/san-diego/ocean-beach-pier).
  // Only these have /tides and /water-temp subpages.
  const pathSegments = pathname.split("/").filter(Boolean);
  const isUsBeachPage =
    pathSegments.length === 3 && /^[a-z]{2}$/.test(pathSegments[0]);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDialogSource, setReviewDialogSource] =
    useState<ReviewTrackingSource>(REVIEW_TRACKING_SOURCES.OVERVIEW_CTA);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedForecastEntry, setSelectedForecastEntry] =
    useState<EnhancedForecastEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [alertCreationOpen, setAlertCreationOpen] = useState(false);
  const [alertRulesRefreshKey, setAlertRulesRefreshKey] = useState(0);
  const [secondaryDataReady, setSecondaryDataReady] = useState(false);
  const [activeTab, setActiveTab] = useState<BeachTabValue>(
    defaultTab || "forecast",
  );
  const { track: trackEvent } = useTrackEvent();

  // -------------------------------------------------------------------------
  // Surgical instrumentation refs (forecast_ready, scroll_depth, time_on_page,
  // empty_state_shown, first_beach_view_post_signup). See the individual
  // effects below for the behavior contract each ref supports.
  // -------------------------------------------------------------------------
  const fetchStartRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0,
  );
  const forecastReadyFiredForBeachRef = useRef<string | null>(null);
  const scrollBucketsFiredRef = useRef<Set<number>>(new Set());
  const pageStartRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0,
  );
  const timeOnPageFiredRef = useRef(false);
  const emptyStateFiredRef = useRef<Set<string>>(new Set());
  const firstBeachViewCheckedRef = useRef(false);

  // CTA impression refs — scoped to the beach detail surface.
  // - Signup CTA is anonymous-only; disable for authed users to avoid work.
  // - Review/intel/session CTAs are authed-only display; disable for anon.
  const signupCtaRef = useCtaImpression<HTMLDivElement>({
    ctaId: "inline_signup_beach_detail",
    surface: "beach_detail",
    enabled: publicMode && !user,
  });
  const reviewCtaRef = useCtaImpression<HTMLDivElement>({
    ctaId: "review_cta_reviews_tab",
    surface: "beach_detail",
    enabled: !publicMode && !!user,
  });
  const intelCtaRef = useCtaImpression<HTMLDivElement>({
    ctaId: "intel_cta_intel_tab",
    surface: "beach_detail",
    enabled: !publicMode && !!user,
  });
  const sessionCtaRef = useCtaImpression<HTMLDivElement>({
    ctaId: "session_log_cta_beach_detail",
    surface: "beach_detail",
    enabled: !publicMode && !!user,
  });

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

  // Above-fold essentials only: beach, forecasts, and hero sources.
  // Secondary tab metrics/calibration load after first paint and active-tab intent.
  const {
    beach,
    forecasts = EMPTY_FORECASTS,
    forecastMetadata,
    forecastSource,
    forecastCached,
    sources,
    loading,
    errors,
    refetch,
  } = useBeachDetailData({
    beachId: id,
    initialBeach,
    forecastDays: 10,
  });

  useEffect(() => {
    setSecondaryDataReady(false);
    const run = (): void => setSecondaryDataReady(true);

    if (
      typeof window !== "undefined" &&
      "requestIdleCallback" in window &&
      typeof window.requestIdleCallback === "function"
    ) {
      const handle = window.requestIdleCallback(run, { timeout: 1800 });
      return () => window.cancelIdleCallback(handle);
    }

    const timeout = window.setTimeout(run, 600);
    return () => window.clearTimeout(timeout);
  }, [id]);

  const calibrationBeachId =
    secondaryDataReady && activeTab === "sessions" ? id : undefined;
  const { sessionSnapshots } = useForecastCalibration({
    beachId: calibrationBeachId,
  });

  // Fetch yesterday's accuracy data
  const shouldFetchYesterdayAccuracy =
    secondaryDataReady && activeTab === "forecast";
  const fetchAccuracy = useCallback(async () => {
    if (!shouldFetchYesterdayAccuracy) return null;
    return await getYesterdayAccuracy(id);
  }, [id, shouldFetchYesterdayAccuracy]);
  const { data: yesterdayAccuracy } = useDataFetcher(fetchAccuracy, {
    skip: !shouldFetchYesterdayAccuracy,
  });

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

  // Reset forecast-ready timing on beach change so navigating to a new beach
  // re-fires. useBeachDetailData kicks off fetches on mount / when beachId
  // changes, so anchoring the start timestamp on beachId transition is a
  // best-effort proxy for the true fetch start.
  useEffect(() => {
    fetchStartRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;
    forecastReadyFiredForBeachRef.current = null;
  }, [id]);

  // forecast_ready — fire once per beach when forecasts first become available
  useEffect(() => {
    if (!forecasts || forecasts.length === 0) return;
    if (forecastReadyFiredForBeachRef.current === id) return;
    forecastReadyFiredForBeachRef.current = id;
    try {
      trackEvent("forecast_ready", {
        beachId: id,
        metadata: {
          beach_id: id,
          load_time_ms: Math.round(performance.now() - fetchStartRef.current),
          // Surfaced from X-Quiver-Source / X-Quiver-Cached headers on
          // /api/forecasts/update-enhanced. Omit when undefined to avoid
          // shipping fabricated values.
          ...(forecastSource ? { source: forecastSource } : {}),
          ...(typeof forecastCached === "boolean"
            ? { cached: forecastCached }
            : {}),
        },
      });
    } catch {}
  }, [forecasts, id, trackEvent, forecastSource, forecastCached]);

  // scroll_depth — fire one event per bucket (25/50/75/100) per page mount.
  // Throttled to one measurement per ~250ms via a simple time gate.
  useEffect(() => {
    if (typeof window === "undefined") return;
    scrollBucketsFiredRef.current = new Set();
    let lastRun = 0;
    const buckets: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];

    const measure = () => {
      const now = Date.now();
      if (now - lastRun < 250) return;
      lastRun = now;

      const doc = document.scrollingElement || document.documentElement;
      if (!doc) return;
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const docHeight = doc.scrollHeight;
      if (docHeight <= 0) return;
      const pct = ((scrollY + viewportHeight) / docHeight) * 100;

      for (const bucket of buckets) {
        if (pct >= bucket && !scrollBucketsFiredRef.current.has(bucket)) {
          scrollBucketsFiredRef.current.add(bucket);
          try {
            trackEvent("scroll_depth", {
              beachId: id,
              metadata: { surface: "beach_detail", depth_pct: bucket },
              // scrollBucketsFiredRef already guarantees one emission per bucket per mount.
              // Default 1s debounce would silently drop events for users who flick through
              // 25/50/75/100 in the same second.
              debounceMs: 0,
            });
          } catch {}
        }
      }
    };

    // Fire an initial measurement in case the page is already scrolled or the
    // full content fits in the viewport (counts as 100% seen).
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [id, trackEvent]);

  // time_on_page — fire exactly once per page view via the first of:
  // visibilitychange (hidden), beforeunload, or component unmount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    pageStartRef.current = performance.now();
    timeOnPageFiredRef.current = false;
    const wasAuthenticated = Boolean(user);

    const fire = (
      exitVia: "visibility_hidden" | "beforeunload" | "route_change",
    ) => {
      if (timeOnPageFiredRef.current) return;
      timeOnPageFiredRef.current = true;
      try {
        trackEvent("time_on_page", {
          beachId: id,
          metadata: {
            surface: "beach_detail",
            duration_ms: Math.round(performance.now() - pageStartRef.current),
            authenticated: wasAuthenticated,
            exit_via: exitVia,
          },
        });
      } catch {}
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") fire("visibility_hidden");
    };
    const onBeforeUnload = () => fire("beforeunload");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      fire("route_change");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // empty_state_shown — lightweight parallel count fetches so we can fire the
  // event when the user lands on (or switches to) a tab whose content is
  // confirmed-empty. This intentionally duplicates a small amount of work
  // rather than plumbing callbacks through the tab wrapper components.
  const [tabCounts, setTabCounts] = useState<{
    reviews: number | null;
    intel: number | null;
    sessions: number | null;
  }>({ reviews: null, intel: null, sessions: null });
  const [tabCountsLoaded, setTabCountsLoaded] = useState({
    reviews: false,
    intel: false,
    sessions: false,
  });

  useEffect(() => {
    emptyStateFiredRef.current = new Set();
    setTabCounts({ reviews: null, intel: null, sessions: null });
    setTabCountsLoaded({ reviews: false, intel: false, sessions: false });
  }, [beach?.id]);

  useEffect(() => {
    if (!beach || !secondaryDataReady) return;
    if (activeTab !== "reviews" && activeTab !== "intel" && activeTab !== "sessions") {
      return;
    }
    if (tabCountsLoaded[activeTab]) return;

    let cancelled = false;
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const signal = controller?.signal;

    const safeFetchJson = async (url: string) => {
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    const loadCount = async (): Promise<number | null> => {
      if (activeTab === "reviews") {
        return typeof (beach as { review_count?: number }).review_count ===
          "number"
          ? ((beach as { review_count?: number }).review_count ?? null)
          : null;
      }

      if (activeTab === "intel") {
        const hasBeachCoordinates =
          typeof beach.lat === "number" &&
          Number.isFinite(beach.lat) &&
          typeof beach.lon === "number" &&
          Number.isFinite(beach.lon);
        if (!hasBeachCoordinates) return null;
        const intelJson = await safeFetchJson(
          `/api/intel?lat=${beach.lat}&lon=${beach.lon}&radius=2&limit=1`,
        );
        const intelPosts =
          intelJson?.data?.posts ?? intelJson?.posts ?? intelJson?.data ?? null;
        return Array.isArray(intelPosts) ? intelPosts.length : null;
      }

      const sessionsJson = await safeFetchJson(
        `/api/beaches/${beach.id}/sessions?limit=1`,
      );
      const sessionsList =
        sessionsJson?.data?.sessions ??
        sessionsJson?.sessions ??
        sessionsJson?.data ??
        null;
      return Array.isArray(sessionsList) ? sessionsList.length : null;
    };

    void loadCount().then((count) => {
      if (cancelled) return;
      setTabCounts((prev) =>
        prev[activeTab] === count ? prev : { ...prev, [activeTab]: count },
      );
      setTabCountsLoaded((prev) =>
        prev[activeTab] ? prev : { ...prev, [activeTab]: true },
      );
    });

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [activeTab, beach, secondaryDataReady, tabCountsLoaded]);

  // Fire empty_state_shown when the active tab is confirmed-empty.
  // One event per tab per beach mount (Set ref).
  useEffect(() => {
    if (!beach) return;
    const surfaceByTab: Record<string, string> = {
      reviews: "beach_reviews_empty",
      intel: "beach_intel_empty",
      sessions: "beach_sessions_empty",
    };
    const surface = surfaceByTab[activeTab];
    if (!surface) return;

    const count =
      activeTab === "reviews"
        ? tabCounts.reviews
        : activeTab === "intel"
          ? tabCounts.intel
          : tabCounts.sessions;

    if (count !== 0) return; // null = still loading, >0 = not empty
    if (emptyStateFiredRef.current.has(surface)) return;
    emptyStateFiredRef.current.add(surface);
    try {
      trackEvent("empty_state_shown", {
        beachId: beach.id,
        metadata: { surface, beach_id: beach.id },
        // emptyStateFiredRef guarantees one emission per surface per mount.
        // Sibling-tab empty states share the same beachId and would otherwise
        // collapse into a single event under the default 1s debounce.
        debounceMs: 0,
      });
    } catch {}
  }, [activeTab, tabCounts, beach, trackEvent]);

  // first_beach_view_post_signup — one-shot per browser, gated on localStorage.
  // Only fires within 7 days of signup so we measure activation, not resurrection.
  useEffect(() => {
    if (firstBeachViewCheckedRef.current) return;
    if (!user || !beach) return;
    firstBeachViewCheckedRef.current = true;
    try {
      const key = `quiver_first_beach_view_${user.id}`;
      if (typeof window === "undefined") return;
      if (localStorage.getItem(key)) return;
      if (!user.created_at) return;
      const minutesSinceSignup = Math.round(
        (Date.now() - new Date(user.created_at).getTime()) / 60000,
      );
      if (minutesSinceSignup < 0) return;
      if (minutesSinceSignup >= 7 * 24 * 60) return;
      trackEvent("first_beach_view_post_signup", {
        beachId: id,
        metadata: {
          beach_id: id,
          minutes_since_signup: minutesSinceSignup,
        },
      });
      localStorage.setItem(key, "1");
    } catch {}
  }, [user, beach, id, trackEvent]);

  // Select the best forecast using the same time-aware logic as home page
  const currentForecast = useMemo(() => {
    if (!forecasts || forecasts.length === 0) return null;

    const selectedForecast = getClosestForecastToNow(forecasts);

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

  // Horizon strip data for the hero teaser copy (firstHiddenDayName, peakHiddenWaveHeight)
  const horizonDaySummaries = useMemo(() => {
    if (!publicMode || !forecasts.length || !beach) return [];
    return aggregateDayForecasts(forecasts, beach, {
      maxDays: 12,
      timezone: beachTimezone || undefined,
      skillLevel: null,
    });
  }, [publicMode, forecasts, beach, beachTimezone]);

  const firstHiddenDayName = useMemo(() => {
    if (!publicMode || horizonDaySummaries.length <= 3) return null;
    const hiddenDay = horizonDaySummaries[3];
    if (!hiddenDay?.fullDate) return null;
    try {
      return new Date(`${hiddenDay.fullDate}T00:00:00`).toLocaleDateString(
        undefined,
        { weekday: "long" },
      );
    } catch {
      return null;
    }
  }, [publicMode, horizonDaySummaries]);

  // Peak wave height across the hidden days (4-12) for data-driven teaser copy
  const peakHiddenWaveHeight = useMemo(() => {
    if (!publicMode || horizonDaySummaries.length <= 3) return null;
    const hiddenDays = horizonDaySummaries.slice(3);
    const maxHeight = Math.max(
      ...hiddenDays.map((d) => d.maxHeight ?? 0).filter((h) => h > 0),
    );
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

  const handleOpenAlerts = useCallback(() => {
    setAlertCreationOpen(true);
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

  const tabActions = (
    <>
      <BeachAlertCta
        beachId={beach.id}
        beachName={beach.name}
        compact
        refreshKey={alertRulesRefreshKey}
        onOpenAlerts={handleOpenAlerts}
        className="shrink-0"
        freeGrowthPhaseEnabled={freeGrowthPhaseEnabled}
      />
      <Button
        variant="ghost"
        onClick={handleGetDirections}
        disabled={!canGetDirections}
        data-zine-directions
        aria-label="Get directions"
        className="group relative h-10 w-[170px] shrink-0 overflow-visible rounded-none border-0 bg-transparent px-0 text-[#F4EBD8] shadow-none transition-[opacity,transform,box-shadow] duration-300 ease-out hover:bg-transparent focus-visible:ring-2 focus-visible:ring-[#F78E42]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-50 min-[1100px]:w-[220px]"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-[44px] -translate-y-1/2 bg-[url('/images/alerts/directions-button.webp')] bg-contain bg-center bg-no-repeat drop-shadow-[2px_2px_0_rgba(17,16,13,0.28)] transition-transform group-hover:rotate-1 group-hover:scale-[1.02]"
        />
        <span className="relative z-10 flex w-full items-center justify-center pl-[62px] pr-5 font-mono text-[9px] font-black uppercase leading-none tracking-[0.09em] text-[#F4EBD8] min-[1100px]:pl-[78px] min-[1100px]:pr-6 min-[1100px]:text-[10px] min-[1100px]:tracking-[0.1em]">
          <span className="hidden min-[1100px]:inline">Get directions</span>
          <span className="min-[1100px]:hidden">Directions</span>
        </span>
      </Button>
    </>
  );
  return (
    <div className="min-h-screen" style={{ background: "#0D1020" }}>
      {/* Forecast Error Warning Banner */}
      {errors.forecasts && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
          <Alert className="border-amber-200/70 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Forecast data is temporarily unavailable. Some information may be
              missing.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Cream zine page — replaces the dark twilight chrome (immersive hero,
          breadcrumb/H1 overlay, BeachStatsGrid, ConditionsTicker, BeachActions,
          MatchScoreTeaser, TrustStrip). The zine carries its own H1, hero photo,
          and footer; the tabs sit inside the cream paper. */}
      <ZinePageShell
        beach={beach as Beach}
        beachPhoto={beachPhoto}
        sources={sources}
        heroHeadingLevel={heroHeadingLevel}
        heroHeadingSuffix={heroHeadingSuffix}
        heroSummarySlot={heroSummarySlot}
        heroForecastSlot={heroForecastSlot}
      >
        <div ref={signupCtaRef} />
        {beforeTabsContent ? (
          <div className="mx-auto mb-6 max-w-5xl">{beforeTabsContent}</div>
        ) : null}
        {/* Alert discoverability nudge — only for authenticated favorited beaches with no alerts */}
        {!publicMode && beach ? (
          <AlertNudge
            beachId={beach.id}
            beachName={beach.name}
            onSetupAlerts={handleOpenAlerts}
          />
        ) : null}
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
                beachPhoto={beachPhoto}
                surfCallReport={surfCallReport}
                surfCallIsTomorrow={surfCallIsTomorrow}
                beachTimezone={beachTimezone}
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
                  forecastMetadata={forecastMetadata}
                  surfCall={surfCallReport}
                  surfCallIsTomorrow={surfCallIsTomorrow}
                  defaultSubTab={defaultSubTab}
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
              <div ref={reviewCtaRef}>
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
              </div>
            )}
          </BeachTabContent>

          {/* Local Intel Tab */}
          <BeachTabContent value="intel">
            {tabDataLoading ? (
              <TabLoadingSkeleton />
            ) : (
              <div ref={intelCtaRef}>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <IntelTab
                    beach={beach}
                    initialShowAll={searchParams?.get("show") === "all"}
                    publicMode={publicMode}
                    previewCount={1}
                  />
                </Suspense>
              </div>
            )}
          </BeachTabContent>

          {/* Sessions Tab */}
          <BeachTabContent value="sessions">
            <div ref={sessionCtaRef}>
              <Suspense fallback={<TabLoadingSkeleton />}>
                <SessionsTab
                  beach={beach}
                  sessionSnapshots={sessionSnapshots}
                  publicMode={publicMode}
                  previewCount={2}
                />
              </Suspense>
            </div>
          </BeachTabContent>
        </BeachTabs>

        {!publicMode ? (
          <div className="mx-auto mt-10 max-w-5xl">
            <CommunityPhotoUpload
              targetType="beach"
              targetId={beach.id}
              onUploaded={() => router.refresh()}
            />
          </div>
        ) : null}

        {afterTabsContent ? (
          <div className="mt-10">{afterTabsContent}</div>
        ) : null}
      </ZinePageShell>

      {/* MatchScoreTeaser cut from the beach-detail layout — the zine masthead
          is the canonical anonymous CTA surface now. Phase 1A invariant
          deliberately retired (see CHANGELOG entry; e2e/guest-anonymous-cta-
          reduction.spec.ts updated to assert absence). */}

      {/* AnonAlertCaptureForm cut from the beach-detail layout — the email-
          capture flow lives elsewhere now (homepage / alert popover). */}

      {/* Alert Creation Dialog */}
      {!publicMode && alertCreationOpen && (
        <AlertCreationPopover
          beachId={beach.id}
          beachName={beach.name}
          beach={
            {
              id: beach.id,
              name: beach.name,
              slug: (beach as any).slug ?? null,
              lat: beach.lat ?? 0,
              lon: beach.lon ?? 0,
              timezone: (beach as any).timezone ?? "UTC",
              wind_offshore_deg: (beach as any).wind_offshore_deg ?? null,
              wind_offshore_tol_deg:
                (beach as any).wind_offshore_tol_deg ?? null,
              aspect_deg: (beach as any).aspect_deg ?? null,
              preferred_tide_ft_min:
                (beach as any).preferred_tide_ft_min ?? null,
              preferred_tide_ft_max:
                (beach as any).preferred_tide_ft_max ?? null,
              preferred_tide_direction:
                (beach as any).preferred_tide_direction ?? null,
              swell_window_center_deg:
                (beach as any).swell_window_center_deg ?? null,
              swell_window_halfwidth_deg:
                (beach as any).swell_window_halfwidth_deg ?? null,
              break_type: (beach as any).break_type ?? null,
              skill_level: (beach as any).skill_level ?? null,
              features: (beach as any).features ?? null,
              preference_model: (beach as any).preference_model ?? null,
              max_wind_any_mph: (beach as any).max_wind_any_mph ?? null,
              max_wind_onshore_mph: (beach as any).max_wind_onshore_mph ?? null,
            } satisfies BeachAlertMeta
          }
          open={alertCreationOpen}
          onOpenChange={setAlertCreationOpen}
          onRuleCreated={() => setAlertRulesRefreshKey((key) => key + 1)}
          freeGrowthPhaseEnabled={freeGrowthPhaseEnabled}
        />
      )}

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

      {/* Auth modal for the "Set Home Beach" click in publicMode.
          BeachActions' Report Conditions and BeachAlertCta have their own
          inline modals with more specific source attribution. */}
      {publicMode && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source="set-home-beach"
        />
      )}
    </div>
  );
}

// Wrap BeachDetailContent in Suspense to support useSearchParams() during static generation
export function BeachDetail(props: BeachDetailProps) {
  return (
    <Suspense
      fallback={(
        <div
          aria-hidden="true"
          className="min-h-[50vh] animate-pulse bg-muted/20"
        />
      )}
    >
      <BeachDetailContent {...props} />
    </Suspense>
  );
}

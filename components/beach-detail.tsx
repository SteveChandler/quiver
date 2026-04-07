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
import { Navigation, AlertTriangle, Waves, Thermometer, Bell, X } from "lucide-react";
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
import { AlertCreationPopover } from "@/components/alerts/alert-creation-popover";
import type { BeachAlertMeta } from "@/lib/alerts/types";
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
    const beaches: Array<{ id: string }> = body?.data?.beaches || body?.beaches || [];
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
    <div className="flex items-center justify-between px-4 py-2 bg-[#354090]/30 rounded-lg mx-4 mt-2 mb-4">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <Bell className="w-4 h-4 shrink-0 text-[#F78E42]" />
        <span>Get notified when {beachName} has your ideal conditions</span>
      </div>
      <div className="flex items-center gap-2 ml-3 shrink-0">
        <button
          onClick={onSetupAlerts}
          className="text-xs text-[#F78E42] font-medium hover:underline"
        >
          Set Up Alert
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-gray-500 hover:text-gray-400"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
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
  const { user } = useAuth();

  // US beach pages have 3-segment paths starting with a 2-letter state code (e.g., /ca/san-diego/ocean-beach-pier).
  // Only these have /tides and /water-temp subpages.
  const pathSegments = pathname.split("/").filter(Boolean);
  const isUsBeachPage = pathSegments.length === 3 && /^[a-z]{2}$/.test(pathSegments[0]);

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
  const [alertCreationOpen, setAlertCreationOpen] = useState(false);
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

  // PERFORMANCE OPTIMIZATION: Fetch all data in parallel (beach, forecasts, sources)
  // This eliminates the waterfall pattern and dramatically improves load time
  const {
    beach,
    forecasts = EMPTY_FORECASTS,
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
          load_time_ms: Math.round(
            performance.now() - fetchStartRef.current,
          ),
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
            duration_ms: Math.round(
              performance.now() - pageStartRef.current,
            ),
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

  useEffect(() => {
    if (!beach) return;
    let cancelled = false;
    emptyStateFiredRef.current = new Set();
    setTabCounts({ reviews: null, intel: null, sessions: null });

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const signal = controller?.signal;

    // Reviews — use /api/beaches/{id} summary if it ever exposes a count,
    // otherwise fall back to the summary server action via a light endpoint.
    // We don't want to import server actions client-side here, so we hit the
    // sessions endpoint and an intel listing endpoint directly.
    const safeFetchJson = async (url: string) => {
      try {
        const res = await fetch(url, { cache: "no-store", signal });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    // Reviews count: reuse the public beach stats endpoint if present, else
    // just read the aggregate review_count already on the beach row when
    // available. If neither is available, leave as null (which disables the
    // empty-state event for reviews — acceptable fallback).
    const reviewCountFromBeach =
      typeof (beach as { review_count?: number }).review_count === "number"
        ? (beach as { review_count?: number }).review_count ?? null
        : null;

    Promise.all([
      Promise.resolve(reviewCountFromBeach),
      safeFetchJson(
        `/api/intel?lat=${beach.lat}&lon=${beach.lon}&radius=2&limit=1`,
      ),
      safeFetchJson(`/api/beaches/${beach.id}/sessions?limit=1`),
    ]).then(([reviews, intelJson, sessionsJson]) => {
      if (cancelled) return;
      const intelPosts =
        intelJson?.data?.posts ??
        intelJson?.posts ??
        intelJson?.data ??
        null;
      const sessionsList =
        sessionsJson?.data?.sessions ??
        sessionsJson?.sessions ??
        sessionsJson?.data ??
        null;
      setTabCounts({
        reviews: typeof reviews === "number" ? reviews : null,
        intel: Array.isArray(intelPosts) ? intelPosts.length : null,
        sessions: Array.isArray(sessionsList) ? sessionsList.length : null,
      });
    });

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [beach]);

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
    (Boolean(sources?.camera_url) &&
      buildCamEmbed(sources?.camera_url).kind !== "none") ||
    Boolean(sources?.diorama_url);

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
              <div ref={signupCtaRef}>
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
              </div>
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

      {/* Alert discoverability nudge — only for authenticated favorited beaches with no alerts */}
      {!publicMode && beach && (
        <AlertNudge
          beachId={beach.id}
          beachName={beach.name}
          onSetupAlerts={handleOpenAlerts}
        />
      )}

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

        {/* Tide Chart & Water Temp subpage links (US beaches only) */}
        {isUsBeachPage && (
          <div className="flex gap-2 mb-6">
            <Link
              href={`${pathname}/tides`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700 transition-colors"
            >
              <Waves className="h-3.5 w-3.5" />
              Tide Chart
            </Link>
            <Link
              href={`${pathname}/water-temp`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700 transition-colors"
            >
              <Thermometer className="h-3.5 w-3.5" />
              Water Temp
            </Link>
          </div>
        )}

        {/* Action Buttons */}
        <BeachActions
          beach={beach}
          onGetDirections={handleGetDirections}
          canGetDirections={canGetDirections}
          publicMode={publicMode}
          onAuthRequired={handleAuthRequired}
          onOpenAlerts={handleOpenAlerts}
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
      </div>

      {/* Alert Creation Dialog */}
      {!publicMode && alertCreationOpen && (
        <AlertCreationPopover
          beachId={beach.id}
          beachName={beach.name}
          beach={{
            id: beach.id,
            name: beach.name,
            slug: (beach as any).slug ?? null,
            lat: beach.lat ?? 0,
            lon: beach.lon ?? 0,
            timezone: (beach as any).timezone ?? "UTC",
            wind_offshore_deg: (beach as any).wind_offshore_deg ?? null,
            wind_offshore_tol_deg: (beach as any).wind_offshore_tol_deg ?? null,
            aspect_deg: (beach as any).aspect_deg ?? null,
            preferred_tide_ft_min: (beach as any).preferred_tide_ft_min ?? null,
            preferred_tide_ft_max: (beach as any).preferred_tide_ft_max ?? null,
            preferred_tide_direction: (beach as any).preferred_tide_direction ?? null,
            swell_window_center_deg: (beach as any).swell_window_center_deg ?? null,
            swell_window_halfwidth_deg: (beach as any).swell_window_halfwidth_deg ?? null,
          } satisfies BeachAlertMeta}
          open={alertCreationOpen}
          onOpenChange={setAlertCreationOpen}
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

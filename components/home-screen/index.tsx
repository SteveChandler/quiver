"use client";

import { useCallback, useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useLocationSafe } from "@/context/location-context";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { useTimeSlotPrefetch } from "@/hooks/use-time-slot-prefetch";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useReminderHandler } from "@/hooks/use-reminder-handler";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useTrackEvent } from "@/hooks/use-track-event";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { getProfileStrength } from "@/actions/dashboard-actions";
import { getPersonalizationStatus } from "@/actions/personalization-actions";
import { getUserXPStatus } from "@/lib/gamification/gamification-actions";
import { LEVEL_THRESHOLDS } from "@/lib/gamification/constants";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
import { usePersonalizationMilestones } from "@/hooks/use-personalization-milestones";
import type { TimeSlot } from "@/types/personalization";

// New components for single vertical feed
import { GreetingSection } from "./greeting-section";
import { useTimeOfDay } from "./use-time-of-day";
import { HeroRecommendation } from "./hero-recommendation";
import { PrimaryActions } from "./primary-actions";
import { buildSurfCallShareData } from "@/lib/share/share-data-builder";
import { buildRecommendationLogUrl } from "@/lib/recommendations/attribution";
import { buildBeachUrlWithTab } from "@/lib/utils/beach-url-utils";
import { getForecastRegionForCity } from "@/lib/data/forecast-regions";
import { TopSpotsCarousel } from "./top-spots-carousel";
import { TimeSlotSelector } from "./time-slot-selector";
import { BottomNav } from "./bottom-nav";
import { ForecastOutlookCard } from "./forecast-outlook-card";
import { HomeConditionsTicker } from "./home-conditions-ticker";
import { SessionIntelligenceModule } from "./session-intelligence-module";

// Dynamic imports for below-fold components to reduce initial bundle size
const CoastPulse = dynamic(
  () => import("../dashboard/coast-pulse").then((m) => m.CoastPulse),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse bg-[#1e1e1e] rounded-2xl" />
    ),
  }
);
const ProfileStrength = dynamic(
  () => import("../dashboard/profile-strength").then((m) => m.ProfileStrength),
  {
    ssr: false,
    loading: () => (
      <div className="h-[120px] animate-pulse bg-amber-50 rounded-xl" />
    ),
  }
);
const FirstSessionCta = dynamic(
  () => import("./first-session-cta").then((m) => m.FirstSessionCta),
  { ssr: false }
);
const PersonalizationProgress = dynamic(
  () =>
    import("./personalization-progress").then(
      (m) => m.PersonalizationProgress
    ),
  { ssr: false }
);

import { buildQuickLogUrl } from "./first-session-cta";
import type { ReminderResult } from "@/hooks/use-reminder-handler";
import { useHomeDiscoveryRequestMetrics } from "@/hooks/use-home-discovery-request-metrics";

const DEFAULT_LOCATION = { lat: 32.715, lon: -117.161 }; // San Diego

function getLevelTitle(xp: number): string {
  const level = [...LEVEL_THRESHOLDS].reverse().find((l) => xp >= l.xp_required);
  return level?.title || LEVEL_THRESHOLDS[0].title;
}

export function HomeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useAuth();
  const { timeOfDay } = useTimeOfDay();
  const reducedMotion = useReducedMotion();
  const { track: trackEvent } = useTrackEvent();
  const recordHomeDiscoveryRequest = useHomeDiscoveryRequestMetrics();

  // Time slot filter state (initialized from URL param for persistence)
  const validTimeSlots: TimeSlot[] = ['any', 'dawn-patrol', 'lunch-session', 'afternoon'];
  const urlSlot = searchParams.get('slot');
  const initialSlot: TimeSlot = validTimeSlots.includes(urlSlot as TimeSlot)
    ? (urlSlot as TimeSlot)
    : 'any';
  const [timeSlot, setTimeSlot] = useState<TimeSlot>(initialSlot);

  // Wrapper to track time slot changes and persist to URL
  const handleTimeSlotChange = useCallback((newSlot: TimeSlot) => {
    trackEvent("forecast_interaction", {
      metadata: {
        action: "change_slot" as const,
        slot: newSlot,
      },
      debounceMs: 200,
    });
    setTimeSlot(newSlot);

    // Update URL param for persistence
    const params = new URLSearchParams(searchParams.toString());
    if (newSlot === 'any') {
      params.delete('slot');
    } else {
      params.set('slot', newSlot);
    }
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [trackEvent, searchParams, pathname, router]);

  // Profile and home beach
  const { profile, homeBeach, refreshProfile } = useCachedProfile();

  // Location for discovery (no auto-prompt)
  const {
    coords: geoCoords,
    loading: geoLoading,
    error: geoError,
    requestLocation,
    source: geoSource,
    usingDefaultLocation,
  } = useGeolocation({
    autoRequest: false,
    enablePolling: true,
    pollingIntervalMs: 5 * 60 * 1000, // 5 minutes
    minDistanceChangeMeters: 1000, // 1 km
  });

  // IP-based location from LocationContext (middleware cookie)
  const locationCtx = useLocationSafe();
  const ipCoords = locationCtx?.location?.source !== 'default' && !locationCtx?.location?.isLoading
    ? locationCtx?.location?.coordinates
    : null;

  // Reminder handler for forecast alerts (unified push registration)
  const { enableReminder } = useReminderHandler({
    homeBeachId: homeBeach?.id ?? null,
    onProfileUpdate: refreshProfile,
  });

  // Fetch profile strength for onboarding widget
  const fetchProfileStrength = useCallback(() => getProfileStrength(), []);
  const { data: strengthResponse } = useDataFetcher(
    fetchProfileStrength,
    { skip: !profile, initialData: null }
  );
  const profileStrength = strengthResponse?.data || null;

  // Fetch personalization status for progress card
  const fetchPersonalizationStatus = useCallback(async () => {
    if (!profile) return null;
    return await getPersonalizationStatus();
  }, [profile]);
  const { data: personalizationResponse } = useDataFetcher(fetchPersonalizationStatus, {
    skip: !profile,
    initialData: null,
  });
  const personalizationStatus = personalizationResponse?.data ?? null;

  // Fetch user XP status for level badge in greeting
  const fetchUserXP = useCallback(async () => {
    if (!profile) return null;
    return await getUserXPStatus();
  }, [profile]);
  const { data: xpResponse } = useDataFetcher(fetchUserXP, {
    skip: !profile,
    initialData: null,
  });
  const userXP = xpResponse?.data ?? null;
  const xpLevelTitle = userXP ? getLevelTitle(userXP.xp_total) : null;

  // Deliver personalization milestone toasts
  usePersonalizationMilestones(!!profile);

  // Validate coordinates helper
  const isValidCoordinate = (lat: number, lon: number): boolean =>
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  // Determine coast pulse coordinates (fallback chain: GPS > homeBeach > IP location > San Diego)
  const coastPulseCoords = useMemo(() =>
    geoSource === "browser" &&
    !usingDefaultLocation &&
    geoCoords?.lat != null &&
    geoCoords?.lon != null &&
    isValidCoordinate(geoCoords.lat, geoCoords.lon)
      ? { lat: geoCoords.lat, lon: geoCoords.lon }
      : homeBeach?.lat != null && homeBeach?.lon != null
        ? { lat: homeBeach.lat, lon: homeBeach.lon }
        : ipCoords?.lat != null && ipCoords?.lon != null
          ? { lat: ipCoords.lat, lon: ipCoords.lon }
          : DEFAULT_LOCATION,
    [geoSource, usingDefaultLocation, geoCoords?.lat, geoCoords?.lon, homeBeach?.lat, homeBeach?.lon, ipCoords?.lat, ipCoords?.lon]
  );

  // Determine seed location for discovery (with validation)
  // Fallback chain: browser GPS > home beach > IP location > default location (San Diego)
  // This ensures users without configured beaches still see nearby recommendations
  const seedDiscoveryLocation = useMemo(() =>
    geoSource === "browser" &&
    !usingDefaultLocation &&
    geoCoords?.lat != null &&
    geoCoords?.lon != null &&
    isValidCoordinate(geoCoords.lat, geoCoords.lon)
      ? { lat: geoCoords.lat, lon: geoCoords.lon }
      : homeBeach?.lat != null &&
          homeBeach?.lon != null &&
          isValidCoordinate(homeBeach.lat, homeBeach.lon)
        ? { lat: homeBeach.lat, lon: homeBeach.lon }
        : ipCoords?.lat != null && ipCoords?.lon != null &&
            isValidCoordinate(ipCoords.lat, ipCoords.lon)
          ? { lat: ipCoords.lat, lon: ipCoords.lon }
          : DEFAULT_LOCATION,
    [geoSource, usingDefaultLocation, geoCoords?.lat, geoCoords?.lon, homeBeach?.lat, homeBeach?.lon, ipCoords?.lat, ipCoords?.lon]
  );

  // Fetch surf discovery (top recommendation + top spots)
  const {
    discovery,
    loading: discoveryLoading,
    error: discoveryError,
  } = useSurfDiscovery({
    maxResults: 6,
    horizonHours: 24, // Home screen: only consider windows in next 24 hours
    timeSlot, // Pass the selected time slot
    enabled: !!profile && !geoLoading,
    immediate: true,
    userLocation: seedDiscoveryLocation,
    onRequest: () => recordHomeDiscoveryRequest("primary"),
  });

  const recommendationsUnavailable =
    discovery?.recommendationAvailability?.state === "none";

  // Pre-fetch other time slots for instant filter switching
  useTimeSlotPrefetch({
    userLocation: seedDiscoveryLocation,
    horizonHours: 24,
    maxResults: 6,
    currentSlot: timeSlot,
    enabled:
      !!profile &&
      !geoLoading &&
      !discoveryLoading &&
      !recommendationsUnavailable,
  });

  // Extract top recommendation and remaining spots — only show beaches with photos
  const effectiveRecommendations = recommendationsUnavailable
    ? []
    : discovery?.recommendations ?? [];
  const recsWithPhotos = effectiveRecommendations.filter(
    (rec) => rec.beach.photo_url?.startsWith('http')
  );
  const topRecommendation = recsWithPhotos[0] || null;
  const topSpots = recsWithPhotos.slice(1);

  // Derive forecast region from top recommendation or home beach city
  const forecastRegionSlug = useMemo(() => {
    const city = topRecommendation?.beach?.city ?? homeBeach?.city;
    return city ? getForecastRegionForCity(city) : null;
  }, [topRecommendation?.beach?.city, homeBeach?.city]);

  // Compute share data for the Share button in PrimaryActions
  const shareData = useMemo(() => {
    if (!topRecommendation) return null;
    return buildSurfCallShareData({
      recommendation: topRecommendation,
      sessionDecision: discovery?.sessionDecision ?? null,
      timeSlot,
    });
  }, [discovery?.sessionDecision, topRecommendation, timeSlot]);

  // Handler for enabling forecast reminders (delegates to useReminderHandler)
  const handleEnableReminder = useCallback(
    async (beachId: string, beachName: string): Promise<ReminderResult> => {
      return enableReminder(beachId, beachName);
    },
    [enableReminder]
  );

  // Handler for "I'm at the beach" button
  const handleAtBeach = useCallback(() => {
    if (topRecommendation) {
      router.push(
        buildRecommendationLogUrl({
          recommendation: topRecommendation,
          rank: 1,
          surface: "home_hero",
          timeSlot,
        })
      );
    } else {
      router.push("/sessions/new?mode=log");
    }

    // Track for analytics
    track("home_at_beach_click", {
      beach_id: topRecommendation?.beach.id,
      beach_name: topRecommendation?.beach.name,
    });

    // Track for engagement (stored in user_events)
    trackEvent("cta_click", {
      beachId: topRecommendation?.beach.id,
      metadata: {
        cta: "log_session" as const,
        location: "home_primary_actions",
      },
    });

  }, [topRecommendation, router, trackEvent, timeSlot]);

  // Handler for quick-log CTA (zero-session users)
  const handleQuickLog = useCallback(() => {
    const url = buildQuickLogUrl(homeBeach ?? undefined);
    router.push(url);
  }, [homeBeach, router]);

  // Handler for "Plan Weekend" button - navigate to beach forecast tab
  const handlePlanWeekend = useCallback(() => {
    if (!topRecommendation?.beach) {
      track("home_plan_weekend_no_recommendation", { time_slot: timeSlot });
      toast.error("No beach recommendation available. Try selecting 'Any time' in the filter above.");
      return;
    }

    // Track for analytics
    track("home_plan_weekend_click", {
      beach_id: topRecommendation.beach.id,
      beach_name: topRecommendation.beach.name,
    });

    // Track for engagement (stored in user_events)
    trackEvent("cta_click", {
      beachId: topRecommendation.beach.id,
      metadata: {
        cta: "view_forecast" as const,
        location: "home_primary_actions",
      },
    });

    const forecastUrl = buildBeachUrlWithTab(topRecommendation.beach, "forecast");
    router.push(forecastUrl);
  }, [topRecommendation, router, timeSlot, trackEvent]);

  // Handler for viewing beach details from hero
  const handleViewBeach = useCallback(
    (beachId: string) => {
      trackEvent("forecast_interaction", {
        beachId,
        metadata: {
          action: "view_details" as const,
          beach_id: beachId,
        },
      });
      router.push(`/beach/${beachId}?from=home_hero`);
    },
    [router, trackEvent]
  );

  // Handler for viewing beach details from top spots
  const handleViewSpot = useCallback(
    (beachId: string) => {
      trackEvent("forecast_interaction", {
        beachId,
        metadata: {
          action: "view_details" as const,
          beach_id: beachId,
        },
      });
      router.push(`/beach/${beachId}?from=home_top_spots`);
    },
    [router, trackEvent]
  );

  // Wrapper for hero recommendation's onEnableReminder (expects boolean return)
  const handleHeroEnableReminder = useCallback(
    async (beachId: string, beachName: string): Promise<boolean> => {
      const result = await handleEnableReminder(beachId, beachName);
      return result.success;
    },
    [handleEnableReminder]
  );

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 home-container pb-20 md:pb-0 overflow-auto">
        {/* Dark gradient header section */}
        <motion.div
          className="relative overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 rounded-b-2xl sm:rounded-b-3xl"
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={reducedMotion ? {
            visible: {},
          } : {
            hidden: {},
            visible: {
              transition: HOME_HEADER_MOTION.entry,
            },
          }}
        >
          {/* Background photo */}
          <div
            className="absolute inset-0 bg-cover bg-center motion-safe:animate-hero-ken-burns will-change-transform"
            style={{ backgroundImage: "url('/images/home-hero-bg.avif')" }}
          />
          {/* Dark overlay for readability */}
          <div className={`absolute inset-0 ${reducedMotion
            ? "bg-gradient-to-b from-header-start to-header-end"
            : "bg-gradient-to-b from-[#0A0E1A]/80 via-[#0A0E1A]/50 to-[#0A0E1A]/90 animate-hero-gradient-shift"
          }`} />
          {/* Noise texture on overlay */}
          <div className="absolute inset-0 noise-texture-strong pointer-events-none" />
          {/* Scan lines overlay */}
          <div className="absolute inset-0 scan-lines pointer-events-none" />
          {/* Content */}
          <div className="relative z-10 pt-8 sm:pt-10 pb-8 px-4 sm:px-6 lg:px-8 space-y-6 xs:space-y-8">
            {/* 1. Greeting Section */}
            <motion.section
              className="centered-container"
              variants={reducedMotion ? { visible: { opacity: 1, y: 0 } } : HOME_HEADER_MOTION.entryItem}
            >
              <GreetingSection
                userName={profile?.full_name || null}
                timeOfDay={timeOfDay}
                levelTitle={xpLevelTitle}
                xpTotal={userXP?.xp_total ?? null}
              />
            </motion.section>

            {/* 2. Time Slot Filter */}
            {profile && !recommendationsUnavailable && (
              <motion.section
                className="centered-container"
                variants={reducedMotion ? { visible: { opacity: 1, y: 0 } } : HOME_HEADER_MOTION.entryItem}
              >
                <TimeSlotSelector
                  value={timeSlot}
                  onChange={handleTimeSlotChange}
                  className="mb-2"
                />
              </motion.section>
            )}

            {/* 3. Hero Recommendation */}
            {profile && (
              <motion.section
                className="centered-container"
                variants={reducedMotion ? { visible: { opacity: 1, y: 0 } } : HOME_HEADER_MOTION.entryItem}
              >
                {recommendationsUnavailable ? (
                  <div
                    className="px-4 py-4 text-center sm:px-1"
                    data-testid="recommendation-unavailable-state"
                    role="status"
                  >
                    <p className="text-base text-high sm:text-lg">
                      Session picks aren&apos;t available right now.
                    </p>
                    <p className="mt-1 text-xs text-medium sm:text-sm">
                      Objective conditions remain available below.
                    </p>
                  </div>
                ) : (
                  <HeroRecommendation
                    recommendation={topRecommendation}
                    loading={discoveryLoading}
                    error={discoveryError ? new Error(discoveryError) : null}
                    onViewBeach={handleViewBeach}
                    onEnableReminder={handleHeroEnableReminder}
                    forecastAlertsEnabled={profile.notif_forecast_alerts ?? false}
                    homeBeachId={homeBeach?.id ?? null}
                    timeSlot={timeSlot}
                  />
                )}
              </motion.section>
            )}

            {/* 4. Primary Actions (or FirstSessionCta for zero-session users) */}
            {profile && !recommendationsUnavailable && (
              <motion.section
                className="centered-container"
                variants={reducedMotion ? { visible: { opacity: 1, y: 0 } } : HOME_HEADER_MOTION.entryItem}
              >
                {personalizationStatus?.sessionCount === 0 ? (
                  <FirstSessionCta onLogSession={handleQuickLog} />
                ) : topRecommendation ? (
                  <PrimaryActions
                    topRecommendation={topRecommendation}
                    onAtBeach={handleAtBeach}
                    onPlanWeekend={handlePlanWeekend}
                    disabled={discoveryLoading}
                    shareData={shareData}
                  />
                ) : !discoveryLoading && discovery?.recommendations.length === 0 && timeSlot !== 'any' ? (
                  <div className="text-center py-8 px-4" data-testid="time-slot-empty-state">
                    <p className="text-high mb-3">
                      No great {timeSlot === 'dawn-patrol' ? 'dawn patrol' : timeSlot} windows in the next 24 hours.
                    </p>
                    <button
                      onClick={() => setTimeSlot('any')}
                      className="text-white hover:text-white/90 underline text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-header-end"
                    >
                      Show all times
                    </button>
                  </div>
                ) : !discoveryLoading ? (
                  <div className="flex flex-col gap-3 px-4 sm:px-1" data-testid="fallback-actions">
                    <button
                      onClick={() => router.push("/map")}
                      className="w-full h-12 sm:h-14 min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-sm sm:text-base border border-white/20 hover:border-white/30 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-header-end"
                    >
                      Explore Beaches Near You
                    </button>
                  </div>
                ) : null}
              </motion.section>
            )}
          </div>
        </motion.div>

        {/* Conditions Ticker - full width for edge-to-edge scroll */}
        {profile && homeBeach?.id && (
          <section className="w-full">
            <HomeConditionsTicker beachId={homeBeach.id} beachName={homeBeach.name} />
          </section>
        )}

        {/* Content below gradient */}
        <div className="pt-6 space-y-6 xs:space-y-8">
          {/* 5. Top Spots Carousel - full width for edge-to-edge scroll */}
          {profile && !recommendationsUnavailable && (
            <section className="w-full">
              <TopSpotsCarousel
                spots={topSpots}
                heroWindow={topRecommendation?.window}
                timeSlot={timeSlot}
                loading={discoveryLoading}
                onViewSpot={handleViewSpot}
                onUseMyLocation={requestLocation}
                showLocationCta={geoSource !== "browser"}
                locationLoading={geoLoading}
              />
            </section>
          )}

          {profile && !discoveryLoading && (
            <section className="centered-container px-4 sm:px-0">
              <SessionIntelligenceModule
                recommendations={effectiveRecommendations}
                recommendationAvailability={discovery?.recommendationAvailability}
              />
            </section>
          )}

          {/* Personalization Progress Card */}
          {profile && (
            <section className="centered-container px-4 sm:px-0">
              <PersonalizationProgress status={personalizationStatus} />
            </section>
          )}

          {/* 6. 7-Day Outlook Entry Point */}
          {profile && (
            <section className="centered-container px-4 sm:px-0">
              <ForecastOutlookCard regionSlug={forecastRegionSlug ?? undefined} />
            </section>
          )}

          {/* 7. Coast Pulse Timeline - detailed vertical list */}
          {profile && (
            <section className="centered-container px-4 sm:px-0">
              <CoastPulse lat={coastPulseCoords.lat} lon={coastPulseCoords.lon} />
            </section>
          )}

          {/* 8. Profile Strength (auto-hides when complete) */}
          {profile && (
            <section className="centered-container px-4 sm:px-0">
              <ProfileStrength strength={profileStrength} />
            </section>
          )}
        </div>
      </main>

      {/* Bottom Navigation (mobile only) */}
      <BottomNav />
    </div>
  );
}

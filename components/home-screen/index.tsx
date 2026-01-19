"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useReminderHandler } from "@/hooks/use-reminder-handler";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { track } from "@/lib/analytics";
import { getUserBoards, getProfileStrength } from "@/actions/dashboard-actions";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
import type { TimeSlot } from "@/types/personalization";

// New components for single vertical feed
import { GreetingSection } from "./greeting-section";
import { useTimeOfDay } from "./use-time-of-day";
import { HeroRecommendation } from "./hero-recommendation";
import { PrimaryActions } from "./primary-actions";
import { TopSpotsCarousel } from "./top-spots-carousel";
import { TimeSlotSelector } from "./time-slot-selector";
import { CoastPulse } from "../dashboard/coast-pulse";
import { ProfileStrength } from "../dashboard/profile-strength";
import { BottomNav } from "./bottom-nav";

import type { ReminderResult } from "@/hooks/use-reminder-handler";

export function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { timeOfDay } = useTimeOfDay();
  const reducedMotion = useReducedMotion();

  // Time slot filter state
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('any');

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

  // Reminder handler for forecast alerts (unified push registration)
  const { enableReminder } = useReminderHandler({
    homeBeachId: homeBeach?.id ?? null,
    onProfileUpdate: refreshProfile,
  });

  // Fetch user's boards for personalization
  const { data: boardsResponse } = useDataFetcher(() => getUserBoards(), {
    skip: !profile,
    initialData: null,
  });

  // Fetch profile strength for onboarding widget
  const { data: strengthResponse } = useDataFetcher(
    () => getProfileStrength(),
    { skip: !profile, initialData: null }
  );
  const profileStrength = strengthResponse?.data || null;

  // Determine coast pulse coordinates (fallback chain: homeBeach > geolocation > San Diego)
  const DEFAULT_LOCATION = { lat: 32.715, lon: -117.161 }; // San Diego
  const coastPulseCoords =
    homeBeach?.lat != null && homeBeach?.lon != null
      ? { lat: homeBeach.lat, lon: homeBeach.lon }
      : geoCoords?.lat != null && geoCoords?.lon != null
        ? { lat: geoCoords.lat, lon: geoCoords.lon }
        : DEFAULT_LOCATION;


  // Validate coordinates helper
  const isValidCoordinate = (lat: number, lon: number): boolean =>
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  // Determine seed location for discovery (with validation)
  // Fallback chain: browser GPS > home beach > default location (San Diego)
  // This ensures users without configured beaches still see nearby recommendations
  const seedDiscoveryLocation =
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
        : DEFAULT_LOCATION;

  // Fetch surf discovery (top recommendation + top spots)
  const {
    discovery,
    loading: discoveryLoading,
    error: discoveryError,
  } = useSurfDiscovery({
    maxResults: 6,
    horizonHours: 24, // Home screen: only consider windows in next 24 hours
    timeSlot, // Pass the selected time slot
    enabled: !!profile,
    immediate: true,
    userLocation: seedDiscoveryLocation,
  });

  // Extract top recommendation and remaining spots (show all, no limit)
  const topRecommendation = discovery?.recommendations[0] || null;
  const topSpots = discovery?.recommendations.slice(1) || [];

  // Handler for enabling forecast reminders (delegates to useReminderHandler)
  const handleEnableReminder = useCallback(
    async (beachId: string, beachName: string): Promise<ReminderResult> => {
      return enableReminder(beachId, beachName);
    },
    [enableReminder]
  );

  // Handler for "I'm at the beach" button
  const handleAtBeach = useCallback(() => {
    // Navigate to session creation with mode=log
    const params = new URLSearchParams({ mode: "log" });

    // Pre-fill with top recommendation if available
    if (topRecommendation) {
      params.set("beach", topRecommendation.beach.id);
      params.set("beachName", topRecommendation.beach.name);
      params.set("startTime", topRecommendation.window.start.toISOString());
    }

    track("home_at_beach_click", {
      beach_id: topRecommendation?.beach.id,
      beach_name: topRecommendation?.beach.name,
    });

    router.push(`/sessions/new?${params.toString()}`);
  }, [topRecommendation, router]);

  // Handler for "Plan Weekend" button
  const handlePlanWeekend = useCallback(() => {
    // Navigate to session creation with mode=plan
    const params = new URLSearchParams({ mode: "plan" });

    track("home_plan_weekend_click", {
      beach_id: topRecommendation?.beach.id,
      beach_name: topRecommendation?.beach.name,
    });

    router.push(`/sessions/new?${params.toString()}`);
  }, [topRecommendation, router]);

  // Handler for viewing beach details from hero
  const handleViewBeach = useCallback(
    (beachId: string) => {
      router.push(`/beach/${beachId}?from=home_hero`);
    },
    [router]
  );

  // Handler for viewing beach details from top spots
  const handleViewSpot = useCallback(
    (beachId: string) => {
      router.push(`/beach/${beachId}?from=home_top_spots`);
    },
    [router]
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
          className="bg-gradient-to-b from-header-start to-header-end pt-6 pb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 space-y-6 xs:space-y-8"
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
          {/* 1. Greeting Section */}
          <motion.section
            className="centered-container"
            variants={reducedMotion ? { visible: { opacity: 1, y: 0 } } : HOME_HEADER_MOTION.entryItem}
          >
            <GreetingSection
              userName={profile?.full_name || null}
              timeOfDay={timeOfDay}
            />
          </motion.section>

          {/* 2. Time Slot Filter */}
          {profile && (
            <motion.section
              className="centered-container"
              variants={reducedMotion ? { visible: { opacity: 1, y: 0 } } : HOME_HEADER_MOTION.entryItem}
            >
              <TimeSlotSelector
                value={timeSlot}
                onChange={setTimeSlot}
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
              <HeroRecommendation
                recommendation={topRecommendation}
                loading={discoveryLoading}
                error={discoveryError ? new Error(discoveryError) : null}
                onPlanSession={handleAtBeach}
                onViewBeach={handleViewBeach}
                onEnableReminder={handleHeroEnableReminder}
                forecastAlertsEnabled={profile.notif_forecast_alerts ?? false}
                homeBeachId={homeBeach?.id ?? null}
                timeSlot={timeSlot}
              />
            </motion.section>
          )}

          {/* 4. Primary Actions */}
          {profile && (
            <motion.section
              className="centered-container"
              variants={reducedMotion ? { visible: { opacity: 1, y: 0 } } : HOME_HEADER_MOTION.entryItem}
            >
              {topRecommendation ? (
                <PrimaryActions
                  topRecommendation={topRecommendation}
                  onAtBeach={handleAtBeach}
                  onPlanWeekend={handlePlanWeekend}
                  disabled={discoveryLoading}
                />
              ) : !discoveryLoading && discovery?.recommendations.length === 0 && timeSlot !== 'any' ? (
                <div className="text-center py-8 px-4" data-testid="time-slot-empty-state">
                  <p className="text-white/80 mb-3">
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
                    onClick={() => router.push("/discover")}
                    className="w-full h-12 sm:h-14 min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-sm sm:text-base border border-white/20 hover:border-white/30 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-header-end"
                  >
                    Explore Beaches Near You
                  </button>
                </div>
              ) : null}
            </motion.section>
          )}
        </motion.div>

        {/* Content below gradient */}
        <div className="pt-6 space-y-6 xs:space-y-8">
          {/* 5. Top Spots Carousel - full width for edge-to-edge scroll */}
          {profile && (
            <section className="w-full">
              <TopSpotsCarousel
                spots={topSpots}
                loading={discoveryLoading}
                onPlanSession={handleAtBeach}
                onViewSpot={handleViewSpot}
                onUseMyLocation={requestLocation}
                showLocationCta={geoSource !== "browser"}
                locationLoading={geoLoading}
              />
            </section>
          )}

          {/* 6. Coast Pulse Timeline - detailed vertical list */}
          {profile && (
            <section className="centered-container px-4 sm:px-0">
              <CoastPulse lat={coastPulseCoords.lat} lon={coastPulseCoords.lon} />
            </section>
          )}

          {/* 7. Profile Strength (auto-hides when complete) */}
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

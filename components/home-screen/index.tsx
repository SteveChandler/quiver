"use client";

import { useState, Suspense, lazy, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useAuth } from "@/context/auth-context";
import { useHomeData } from "./use-home-data";

import { useCachedProfile } from "@/hooks/use-cached-profile";
import type { Beach } from "@/types/database";
import { BeachSearchBar } from "./beach-search-bar";
import { useGeo } from "@/hooks/useGeo";
import {
  OnboardingFlow,
  useOnboardingFlow,
} from "@/components/onboarding/onboarding-flow";
import { FloatingInteractionHint } from "@/components/engagement/micro-interactions";

// Lazy load heavy tab components
const ForecastTab = lazy(() =>
  import("./forecast-tab").then((m) => ({ default: m.ForecastTab }))
);
const NearbyTab = lazy(() =>
  import("./nearby-tab").then((m) => ({ default: m.NearbyTab }))
);
const CommunityTab = lazy(() =>
  import("./community-tab").then((m) => ({ default: m.CommunityTab }))
);

// Loading component for tabs
function TabSkeleton() {
  return (
    <div className="w-full h-96 bg-gradient-to-r from-gray-100 to-gray-200 animate-pulse rounded-lg">
      <div className="flex items-center justify-center h-full">
        <div className="loading-spinner" />
      </div>
    </div>
  );
}

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState("forecast");
  const [selectedBeachOverride, setSelectedBeachOverride] =
    useState<Beach | null>(null);
  const { user } = useAuth();
  const { beaches, sessions, loading } = useHomeData();

  // 🚨 EMERGENCY: Onboarding flow to fix 0% retention
  const {
    showOnboarding,
    hasCompletedOnboarding,
    completeOnboarding,
    closeOnboarding,
  } = useOnboardingFlow();

  // Use cached profile hook to prevent flickering on navigation
  const { profile, defaultBeach, profileLoading, hasCachedData } =
    useCachedProfile();

  const { coords, source, requestLocation } = useGeo();

  useEffect(() => {
    // On mount: get {lat, lon} and call morning recommendations
    if (!coords) return;
    const controller = new AbortController();
    (async () => {
      try {
        await fetch("/api/recommendations/morning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: coords.lat,
            lon: coords.lon,
            radius_km: 25,
          }),
          signal: controller.signal,
        });
      } catch {}
    })();
    return () => controller.abort();
  }, [coords]);

  console.log("🏠 HomeScreen Summary:", {
    hasUser: !!user,
    hasProfile: !!profile,
    hasDefaultBeach: !!defaultBeach,
    defaultBeachName: defaultBeach?.name,
    profileLoading,
    hasCachedData,
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* 🚨 EMERGENCY: Onboarding Flow - Fix 0% retention */}
      <OnboardingFlow
        isOpen={showOnboarding}
        onClose={closeOnboarding}
        onComplete={completeOnboarding}
      />

      {/* Note: EngagementProgressTracker removed - only needed for unauthenticated landing page visitors */}

      {/* Interaction hints for new users */}
      {!hasCompletedOnboarding && (
        <FloatingInteractionHint
          target="tabs"
          hint="Try exploring different tabs to see forecasts and community intel!"
          delay={5000}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 home-container py-6 sm:py-8 lg:py-10 space-y-8 sm:space-y-10 lg:space-y-12 overflow-auto pt-6">
        {/* Welcome Section */}
        <section className="centered-container space-y-3">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
            Hey, {user ? profile?.full_name || "Surfer" : "Guest"}!
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg lg:text-xl">
            The waves are looking good today. Ready to catch some?
          </p>
        </section>

        {/* Tabs Section */}
        <section className="centered-container">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value)}
            className="space-y-6"
          >
            <TabsList className="grid grid-cols-3 w-full mx-auto h-12 sm:h-14">
              <TabsTrigger value="forecast" className="text-sm sm:text-base">
                Forecast
              </TabsTrigger>
              <TabsTrigger value="nearby" className="text-sm sm:text-base">
                Nearby
              </TabsTrigger>
              <TabsTrigger value="community" className="text-sm sm:text-base">
                Local Intel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="forecast">
              <Suspense fallback={<TabSkeleton />}>
                {/* Centered Search Bar under the tabs */}
                <BeachSearchBar
                  onSelect={(b) => setSelectedBeachOverride(b)}
                  className="mb-4"
                />
                <ForecastTab
                  profile={profile}
                  defaultBeach={defaultBeach}
                  overrideBeach={selectedBeachOverride}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="nearby">
              <Suspense fallback={<TabSkeleton />}>
                <NearbyTab beaches={beaches} loading={loading} />
              </Suspense>
            </TabsContent>

            <TabsContent value="community">
              <Suspense fallback={<TabSkeleton />}>
                <CommunityTab sessions={sessions} loading={loading} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}

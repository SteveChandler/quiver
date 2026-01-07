"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { useHomeData } from "./use-home-data";

import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useGeolocation } from "@/hooks/use-geolocation";
import { track } from "@/lib/analytics";

// Import tab components directly to debug lazy loading issue
import { ForecastTab } from "./forecast-tab";
import { CommunityTab } from "./community-tab";

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
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam && ["forecast", "community"].includes(tabParam)
      ? tabParam
      : "forecast"
  );
  const router = useRouter();
  const { user } = useAuth();
  const { sessions, loading } = useHomeData();

  // Track tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    track("home_tab_click", {
      tab: value,
      user_authenticated: !!user,
    });
  };

  // Use cached profile hook to prevent flickering on navigation
  const { profile, homeBeach, profileLoading, hasCachedData, refreshProfile } =
    useCachedProfile();

  // Home screen should never auto-prompt for location.
  // We still expose `requestLocation()` for explicit CTAs (e.g. NearbyBeachChips).
  // Polling is enabled to detect traveling users - it only activates after permission is granted
  // and will update nearest beaches if the user has moved more than 1km.
  const { coords, source, requestLocation } = useGeolocation({
    autoRequest: false,
    enablePolling: true,
    pollingIntervalMs: 5 * 60 * 1000, // 5 minutes
    minDistanceChangeMeters: 1000, // 1 km
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Note: EngagementProgressTracker removed - only needed for unauthenticated landing page visitors */}

      {/* Optional: Interaction hints can be reintroduced with server flag if desired */}

      {/* Main Content */}
      <main className="flex-1 home-container py-6 sm:py-8 lg:py-10 space-y-8 overflow-auto pt-6">
        {/* Welcome Section */}
        <section className="centered-container space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-roboto font-bold leading-tight sm:leading-[44px] text-gray-900">
              Hey, {user ? profile?.full_name || "Surfer" : "Guest"}!
            </h2>
            <p className="text-base text-gray-600 mt-3">
              The waves are looking good today. Ready to catch some?
            </p>
          </div>

          {/* Action buttons removed from above-fold - available in PersonalizedForecastCard footer */}
        </section>

        {/* Tabs Section */}
        <section className="centered-container">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-4"
          >
            {/* AllTrails-style tab navigation (Phase 2) */}
            <TabsList className="w-full justify-start border-b-2 border-gray-200 mb-4 rounded-none bg-transparent p-0 h-auto">
              <TabsTrigger
                value="forecast"
                className="rounded-none border-b-2 border-transparent -mb-0.5 px-2 py-2 sm:px-6 sm:py-3 text-xs sm:text-base font-medium text-gray-600 transition-all duration-200 hover:bg-gray-50 hover:text-gray-900 data-[state=active]:border-ocean-blue data-[state=active]:text-ocean-blue data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Forecast
              </TabsTrigger>
              <TabsTrigger
                value="community"
                className="rounded-none border-b-2 border-transparent -mb-0.5 px-2 py-2 sm:px-6 sm:py-3 text-xs sm:text-base font-medium text-gray-600 transition-all duration-200 hover:bg-gray-50 hover:text-gray-900 data-[state=active]:border-ocean-blue data-[state=active]:text-ocean-blue data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Local Intel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="forecast" className="relative z-0">
              <ForecastTab
                profile={profile}
                homeBeach={homeBeach}
                onProfileUpdate={refreshProfile}
              />
            </TabsContent>

            <TabsContent value="community" className="relative z-0">
              <CommunityTab sessions={sessions} loading={loading} />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

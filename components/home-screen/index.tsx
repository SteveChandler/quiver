"use client";

import { useState, Suspense, lazy, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNavigation } from "@/components/bottom-navigation";
import { CalendarDays, Waves } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { useHomeData } from "./use-home-data";

import { useCachedProfile } from "@/hooks/use-cached-profile";
import type { Beach } from "@/types/database";

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
  const { user } = useAuth();
  const { beaches, sessions, loading } = useHomeData();

  // Use cached profile hook to prevent flickering on navigation
  const { profile, defaultBeach, profileLoading, hasCachedData } =
    useCachedProfile();

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

        {/* Quick Actions */}
        <section className="centered-container">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {user ? (
              <>
                <Link href="/plan-session">
                  <Button
                    className="h-auto py-6 sm:py-8 flex flex-col items-center gap-3 w-full text-base sm:text-lg"
                    variant="default"
                  >
                    <CalendarDays className="h-7 w-7 sm:h-8 sm:w-8" />
                    <span>Plan Session</span>
                  </Button>
                </Link>
                <Link href="/log-session">
                  <Button
                    className="h-auto py-6 sm:py-8 flex flex-col items-center gap-3 w-full text-base sm:text-lg"
                    variant="outline"
                  >
                    <Waves className="h-7 w-7 sm:h-8 sm:w-8" />
                    <span>Add to Journal</span>
                  </Button>
                </Link>
              </>
            ) : (
              <div className="col-span-2 text-center p-8 sm:p-10 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground mb-4 text-base sm:text-lg">
                  Sign in to plan and log your surf sessions
                </p>
                <Link href="/auth/sign-in">
                  <Button size="lg">Sign In to Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Tabs Section */}
        <section className="centered-container">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value)}
            className="space-y-6"
          >
            <TabsList className="grid grid-cols-3 w-full max-w-3xl mx-auto h-12 sm:h-14">
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
                <ForecastTab profile={profile} defaultBeach={defaultBeach} />
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

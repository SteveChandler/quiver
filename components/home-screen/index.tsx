"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNavigation } from "@/components/bottom-navigation";
import { CalendarDays, Waves, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { ForecastTab } from "./forecast-tab";
import { NearbyTab } from "./nearby-tab";
import { CommunityTab } from "./community-tab";
import { useHomeData } from "./use-home-data";
import { cn } from "@/lib/utils";
import { useUserProfile } from "@/hooks/use-user-profile";

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState("forecast");
  const [isNavVisible, setIsNavVisible] = useState(true);
  const { user } = useAuth();
  const { beaches, sessions, loading } = useHomeData();

  // Use shared profile loading hook with built-in timeout
  const { profile } = useUserProfile({
    userId: user?.id,
    enabled: !!user,
    timeout: 10000, // 10 second timeout
  });

  // Track navigation visibility for FAB positioning
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;

    const handleUserActivity = () => {
      setIsNavVisible(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setIsNavVisible(false);
      }, 3000);
    };

    // Initial setup
    handleUserActivity();

    // Add event listeners
    const options = { passive: true };
    window.addEventListener("scroll", handleUserActivity, options);
    window.addEventListener("touchstart", handleUserActivity, options);
    window.addEventListener("touchmove", handleUserActivity, options);
    window.addEventListener("mousemove", handleUserActivity, options);

    return () => {
      clearTimeout(hideTimeout);
      window.removeEventListener("scroll", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("touchmove", handleUserActivity);
      window.removeEventListener("mousemove", handleUserActivity);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Main Content */}
      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto pt-6">
        {/* Welcome Section */}
        <section className="space-y-2">
          <h2 className="text-2xl font-bold">
            Hey, {user ? profile?.full_name || "Surfer" : "Guest"}!
          </h2>
          <p className="text-muted-foreground">
            The waves are looking good today. Ready to catch some?
          </p>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {user ? (
            <>
              <Link href="/plan-session">
                <Button
                  className="h-auto py-4 flex flex-col items-center gap-2 w-full"
                  variant="default"
                >
                  <CalendarDays className="h-6 w-6" />
                  <span>Plan Session</span>
                </Button>
              </Link>
              <Link href="/log-session">
                <Button
                  className="h-auto py-4 flex flex-col items-center gap-2 w-full"
                  variant="outline"
                >
                  <Waves className="h-6 w-6" />
                  <span>Add to Journal</span>
                </Button>
              </Link>
            </>
          ) : (
            <div className="col-span-2 text-center p-8 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground mb-4">
                Sign in to plan and log your surf sessions
              </p>
              <Link href="/auth/sign-in">
                <Button>Sign In to Get Started</Button>
              </Link>
            </div>
          )}
        </section>

        {/* Tabs Section */}
        <Tabs
          defaultValue="forecast"
          className="space-y-4"
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList className="grid grid-cols-3 w-full max-w-2xl mx-auto">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="nearby">Nearby</TabsTrigger>
            <TabsTrigger value="community">Local Intel</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast">
            <ForecastTab profile={profile} />
          </TabsContent>

          <TabsContent value="nearby">
            <NearbyTab beaches={beaches} loading={loading} />
          </TabsContent>

          <TabsContent value="community">
            <CommunityTab sessions={sessions} loading={loading} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Action Button */}
      {user && (
        <div
          className={cn(
            "fixed right-4 z-10 transition-all duration-300 ease-in-out",
            isNavVisible ? "bottom-20" : "bottom-6"
          )}
        >
          <Link href="/log-session">
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}

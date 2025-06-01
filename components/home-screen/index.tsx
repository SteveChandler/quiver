"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNavigation } from "@/components/bottom-navigation";
import { CalendarDays, Waves, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { ForecastTab } from "./forecast-tab";
import { NearbyTab } from "./nearby-tab";
import { CommunityTab } from "./community-tab";
import { useHomeData } from "./use-home-data";

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState("forecast");
  const { user, isLoading: authLoading } = useAuth();
  const { beaches, sessions, loading } = useHomeData();

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user?.email) return "G";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="text-2xl font-bold text-primary">Quiver</h1>
          <div className="flex items-center space-x-2">
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : user ? (
              <Link href="/profile">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src="/placeholder.svg?height=32&width=32"
                    alt="User"
                  />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link href="/auth/sign-in">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto">
        {/* Welcome Section */}
        <section className="space-y-2">
          <h2 className="text-2xl font-bold">
            Hey, {user ? user.user_metadata?.full_name || "Surfer" : "Guest"}!
          </h2>
          <p className="text-muted-foreground">
            The waves are looking good today. Ready to catch some?
          </p>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
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
              <span>Log Session</span>
            </Button>
          </Link>
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
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast">
            <ForecastTab />
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
      <div className="fixed bottom-20 right-4 z-10">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}

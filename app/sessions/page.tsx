"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Waves, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { trackPublicPageView } from "@/lib/analytics";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import type { SessionWithDetails } from "@/types/database";

export default function SessionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If authenticated, redirect to profile (journal)
    if (!isLoading && user) {
      redirect("/profile");
      return;
    }

    // Track public page view
    if (!isLoading && !user) {
      trackPublicPageView("sessions-feed");
    }
  }, [user, isLoading]);

  // Fetch public sessions
  useEffect(() => {
    async function fetchPublicSessions() {
      try {
        // For now, show placeholder content
        // TODO: Implement public sessions API endpoint
        setLoading(false);
      } catch (error) {
        console.error("Error fetching public sessions:", error);
        setLoading(false);
      }
    }

    if (!user && !isLoading) {
      fetchPublicSessions();
    }
  }, [user, isLoading]);

  // Show loading state
  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  // Public users see session feed preview
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Waves className="h-10 w-10 text-ocean-blue" />
            Community Sessions
          </h1>
          <p className="text-muted-foreground text-lg">
            See what surfers are logging in your area
          </p>
        </div>

        {/* Public content gate for session feed */}
        <PublicContentGate
          ctaTitle="Join Quiver to see community sessions"
          ctaDescription="Connect with local surfers, view their sessions, and share your own surf stories"
          blurLevel="lg"
          source="sessions-feed"
          className="min-h-[600px]"
        >
          {/* Placeholder session cards */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-ocean-blue/10 to-blue-100/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-ocean-blue/20" />
                      <div>
                        <CardTitle className="text-lg">User Session</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Beach Name • Today
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, idx) => (
                        <Sparkles
                          key={idx}
                          className="h-4 w-4 text-yellow-500 fill-yellow-500"
                        />
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-muted-foreground mb-4">
                    Epic session with clean waves and offshore winds. Perfect
                    conditions for longboarding...
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>❤️ 12 likes</span>
                    <span>💬 5 comments</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </PublicContentGate>

        {/* Call to action */}
        <Card className="mt-8 border-2 border-ocean-blue/20 bg-gradient-to-br from-ocean-blue/5 to-blue-50/50">
          <CardContent className="p-8 text-center">
            <Waves className="h-16 w-16 text-ocean-blue mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              Ready to join the community?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Log your sessions, get forecasts, find surf buddies, and build
              your surf journal
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => router.push("/auth/sign-up")}
                className="bg-ocean-blue hover:bg-ocean-blue/90"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Sign Up
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => router.push("/auth/sign-in")}
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

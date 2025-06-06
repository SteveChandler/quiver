"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Plus, Waves, Loader2 } from "lucide-react";
import { SessionCard } from "@/components/session-card";
import { useAuth } from "@/context/auth-context";
import { getUserSessions } from "@/actions/session-actions";
import type { SessionWithDetails } from "@/types/database";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import Link from "next/link";

export function SessionsView() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [plannedSessions, setPlannedSessions] = useState<SessionWithDetails[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSessions() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await getUserSessions(user.id);
        if (result.success && result.data) {
          // Get current date at midnight for comparison
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Split sessions into past and future
          const past: SessionWithDetails[] = [];
          const future: SessionWithDetails[] = [];

          result.data.forEach((session) => {
            // Handle arrival_time for session date comparison
            const sessionDate = session.arrival_time
              ? new Date(session.arrival_time)
              : null;

            if (sessionDate && sessionDate >= today) {
              future.push(session);
            } else {
              past.push(session);
            }
          });

          setSessions(past);
          setPlannedSessions(future);
        }
      } catch (error) {
        console.error("Error loading sessions:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSessions();
  }, [user]);

  // Helper function to format session description with additional details
  const formatSessionDescription = (session: SessionWithDetails) => {
    const parts = [];

    // Add notes if available
    if (session.notes) {
      parts.push(session.notes);
    }

    // Add wave conditions
    const conditions = [];
    if (session.wave_height) {
      conditions.push(`Wave Height: ${session.wave_height}`);
    }
    if (session.water_temp) {
      conditions.push(`Water Temp: ${session.water_temp}`);
    }
    if (session.wave_quality) {
      conditions.push(`Wave Quality: ${session.wave_quality}/5`);
    }
    if (session.crowd_rating) {
      conditions.push(`Crowd Level: ${session.crowd_rating}/5`);
    }

    if (conditions.length > 0) {
      parts.push(`Conditions: ${conditions.join(", ")}`);
    }

    // Add goals if available
    if (session.goals && session.goals.length > 0) {
      parts.push(`Goals: ${session.goals.join(", ")}`);
    }

    // Add duration if available
    if (session.duration_minutes) {
      const hours = Math.floor(session.duration_minutes / 60);
      const minutes = session.duration_minutes % 60;
      const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      parts.push(`Duration: ${durationStr}`);
    }

    return parts.length > 0 ? parts.join(" • ") : "No description provided.";
  };

  // Helper function to format date consistently
  const formatSessionDate = (session: SessionWithDetails) => {
    const date = session.arrival_time ? new Date(session.arrival_time) : null;

    if (!date) return "No date set";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper function to render session cards
  const renderSessionCard = (
    session: SessionWithDetails,
    isPlanned = false
  ) => {
    // Get beach coordinates using the unified resolution function
    const coords = session.beach
      ? resolveBeachCoordinates(session.beach)
      : null;

    // Generate the map image URL
    const mapImageUrl = getStaticMapImageUrl(
      coords?.latitude,
      coords?.longitude,
      { width: 500, height: 350, zoom: 12 }
    );

    return (
      <SessionCard
        key={session.id}
        id={session.id}
        username="You"
        beachName={session.beach?.name || "Unknown Beach"}
        date={formatSessionDate(session)}
        rating={session.rating || 0}
        description={formatSessionDescription(session)}
        imageUrl={mapImageUrl}
        likes={session.likes_count || 0}
        comments={session.comments_count || 0}
        isOwner={true}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="text-xl font-bold">Sessions</h1>
          <Link href="/log-session">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              New Session
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto pb-20">
        <Tabs defaultValue="my-sessions" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="my-sessions">My Sessions</TabsTrigger>
            <TabsTrigger value="planned">Planned</TabsTrigger>
          </TabsList>

          <TabsContent value="my-sessions" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sessions.length > 0 ? (
              <div className="max-w-2xl mx-auto space-y-4">
                {sessions.map((session) => renderSessionCard(session))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>You haven't logged any sessions yet.</p>
                <Button variant="link" asChild>
                  <Link href="/log-session">Log your first session</Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="planned" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : plannedSessions.length > 0 ? (
              <div className="max-w-2xl mx-auto space-y-4">
                {plannedSessions.map((session) =>
                  renderSessionCard(session, true)
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>You don't have any planned sessions.</p>
                <Button variant="link" asChild>
                  <Link href="/plan-session">Plan your first session</Link>
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

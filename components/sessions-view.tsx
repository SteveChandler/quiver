"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, MapPin } from "lucide-react";
import { SessionCard } from "@/components/session-card";
import { useAuth } from "@/context/auth-context";
import { getUserSessions } from "@/actions/session-actions";
import type { SessionWithDetails } from "@/types/database";
import Link from "next/link";

export function SessionsView() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [plannedSessions, setPlannedSessions] = useState<SessionWithDetails[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  // Helper to derive the JS Date for a session using the new `arrival_time` field (falls back to deprecated fields)
  const getSessionDate = (session: SessionWithDetails) => {
    if (session.arrival_time) return new Date(session.arrival_time);
    if (session.session_date) return new Date(session.session_date);
    // If we really have no date stored, return epoch (will be pushed into past list)
    return new Date(0);
  };

  useEffect(() => {
    async function loadSessions() {
      if (!user) return;

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
            const sessionDate = getSessionDate(session);
            sessionDate.setHours(0, 0, 0, 0);

            if (sessionDate >= today) {
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
              sessions.map((session) => {
                const d = getSessionDate(session);
                const displayDate =
                  d.toLocaleDateString() +
                  ", " +
                  d.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                return (
                  <SessionCard
                    key={session.id}
                    username="You"
                    beachName={
                      session.beach?.name ||
                      session.beach_name ||
                      "Unknown Beach"
                    }
                    date={displayDate}
                    rating={session.rating ?? 0}
                    description={
                      session.notes ||
                      session.description ||
                      "No description provided."
                    }
                    imageUrl={
                      session.image_url ||
                      "/placeholder.svg?height=200&width=300"
                    }
                    likes={session.likes_count ?? 0}
                    comments={session.comments_count ?? 0}
                  />
                );
              })
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
              plannedSessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">
                          {session.beach?.name ||
                            session.beach_name ||
                            "Unknown Beach"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {(() => {
                            const d = getSessionDate(session);
                            return (
                              d.toLocaleDateString() +
                              ", " +
                              d.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            );
                          })()}
                        </p>
                        {session.notes && (
                          <p className="text-sm mt-1 text-muted-foreground">
                            {session.notes}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/log-session?edit=${session.id}&mode=log`}>
                          Complete
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
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

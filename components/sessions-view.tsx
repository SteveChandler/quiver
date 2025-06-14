"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Plus, Waves, Loader2 } from "lucide-react";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
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

  // Helper function to render session cards
  const renderSessionCard = (
    session: SessionWithDetails,
    isPlanned = false
  ) => {
    return (
      <SessionCardWrapper
        key={session.id}
        session={session}
        isOwner={true}
        showUserInfo={false}
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

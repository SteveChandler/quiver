"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  List,
  BarChart3,
  Plus,
  Filter,
  TrendingUp,
  Eye,
  EyeOff,
  Settings,
  CalendarClock,
  CheckCircle,
} from "lucide-react";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { CalendarHeatmap } from "./calendar-heatmap";
import { SessionAnalytics } from "./session-analytics";
import { SessionAnnotationModal } from "./session-annotation-modal";
// Removed dropdown filter in favor of Completed/Planned tabs
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getUserSessions } from "@/actions/session-actions";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  SessionWithDetails,
  JournalViewMode,
  JournalDisplayOptions,
  SessionAnalytics as SessionAnalyticsType,
} from "@/types/database";
import Link from "next/link";

interface JournalViewProps {
  className?: string;
}

export function JournalView({ className }: JournalViewProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<JournalViewMode>("list");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<SessionWithDetails | null>(null);
  const [sessionFilter, setSessionFilter] = useState<"planned" | "completed">(
    "completed"
  );
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<JournalDisplayOptions>({
    viewMode: "list",
    showPrivate: true,
  });

  // Fetch user sessions
  const fetchUserSessions = useCallback(async () => {
    if (!user?.id) return [];
    const result = await getUserSessions(user.id);
    if (result.success) {
      return result.data || [];
    }
    throw new Error(result.error || "Failed to fetch sessions");
  }, [user?.id]);

  const {
    data: sessions,
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useDataFetcher(fetchUserSessions, {
    initialData: [] as SessionWithDetails[],
  });

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!user?.id) return null;
    try {
      console.log("🔍 Fetching analytics for user:", user.id);
      const response = await fetch(
        `/api/analytics/sessions?userId=me&type=analytics`,
        {
          credentials: "include", // Ensure cookies are included
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("📡 Analytics response status:", response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(
          "❌ Analytics response not OK:",
          response.status,
          errorData
        );
        throw new Error(
          `Failed to fetch analytics: ${response.status} ${errorData}`
        );
      }
      const data = await response.json();
      console.log("📊 Analytics data received:", JSON.stringify(data, null, 2));
      return data.data || data;
    } catch (error) {
      console.error("💥 Error fetching analytics:", error);
      throw error;
    }
  }, [user?.id]);

  const {
    data: analytics,
    loading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useDataFetcher(fetchAnalytics, { initialData: null });

  useEffect(() => {
    setDisplayOptions((prev) => ({ ...prev, viewMode }));
  }, [viewMode]);

  const handleSessionClick = (session: SessionWithDetails) => {
    setSelectedSession(session);
    setShowAnnotationModal(true);
  };

  const handlePrivacyToggle = async (sessionId: string, isPrivate: boolean) => {
    try {
      const response = await fetch("/api/analytics/sessions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          isPrivate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update session privacy");
      }

      // Refetch sessions to get updated data
      refetchSessions();
    } catch (error) {
      console.error("Error updating session privacy:", error);
    }
  };

  // Filter sessions based on current filter
  const filteredSessions =
    sessions?.filter((session) => session.status === sessionFilter) || [];

  const completedSessions =
    sessions?.filter((session) => session.status === "completed") || [];
  const plannedSessions =
    sessions?.filter((session) => session.status === "planned") || [];

  const totalSessions = filteredSessions.length;
  const totalHours =
    completedSessions.reduce((sum, session) => {
      return sum + (session.duration_minutes || 0);
    }, 0) / 60;

  if (sessionsLoading || analyticsLoading) {
    return <CenteredLoadingSpinner text="Loading your surf journal..." />;
  }

  // If no sessions, show an inviting empty state instead of an error
  const noSessions = (sessions || []).length === 0;
  if (noSessions) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-muted-foreground">
            You haven't logged any sessions yet.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild>
              <Link href="/sessions/new?mode=log">Log your first session</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sessions/new?mode=plan">Plan a session</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="journal-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Surf Journal+</h2>
          <p className="text-muted-foreground">
            Track your sessions, analyze your progress, and share your stoke
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/sessions/new?mode=log">
              <Plus className="h-4 w-4 mr-2" />
              Log Session
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/sessions/new?mode=plan">
              <Plus className="h-4 w-4 mr-2" />
              Plan Session
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{completedSessions.length}</div>
            <p className="text-sm text-muted-foreground">Completed Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{plannedSessions.length}</div>
            <p className="text-sm text-muted-foreground">Planned Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{Math.round(totalHours)}</div>
            <p className="text-sm text-muted-foreground">Hours Surfed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {analytics?.averageRating?.toFixed(1) || "0.0"}
            </div>
            <p className="text-sm text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {analytics?.favoriteBeach || "None"}
            </div>
            <p className="text-sm text-muted-foreground">Home Break</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="sessions">
            <Calendar className="h-4 w-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="insights">
            <BarChart3 className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("calendar")}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{totalSessions} sessions</Badge>
              <Tabs
                value={sessionFilter}
                onValueChange={(value) =>
                  setSessionFilter(value as "planned" | "completed")
                }
              >
                <TabsList>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                  <TabsTrigger value="planned">Planned</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Sessions Display - filtered by tab (Completed default, Planned on click) */}
          {viewMode === "list" ? (
            <div className="space-y-4">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => (
                  <div key={session.id} className="relative">
                    <SessionCardWrapper
                      session={session}
                      isOwner={true}
                      showUserInfo={false}
                      onUserClick={() => handleSessionClick(session)}
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handlePrivacyToggle(session.id, !session.is_public)
                        }
                      >
                        {session.is_public ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSessionClick(session)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground mb-4">
                      {sessionFilter === "planned"
                        ? "No planned sessions yet. Start planning your surf adventures!"
                        : "No completed sessions yet. Start logging your surf sessions!"}
                    </p>
                    <Button asChild>
                      <Link
                        href={
                          sessionFilter === "planned"
                            ? "/plan-session"
                            : "/log-session"
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {sessionFilter === "planned"
                          ? "Plan Your First Session"
                          : "Log Your First Session"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <CalendarHeatmap
              userId={user?.id || ""}
              sessions={filteredSessions}
              onDateClick={(date, sessions) => {
                if (sessions.length > 0) {
                  setSelectedSession(sessions[0]);
                  setShowAnnotationModal(true);
                }
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <SessionAnalytics
            analytics={analytics}
            sessions={completedSessions}
            onRefresh={refetchAnalytics}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {selectedSession && (
        <SessionAnnotationModal
          session={selectedSession}
          isOpen={showAnnotationModal}
          onClose={() => {
            setShowAnnotationModal(false);
            setSelectedSession(null);
          }}
          onSave={() => {
            refetchSessions();
            setShowAnnotationModal(false);
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
}

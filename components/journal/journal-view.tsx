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
  Share2,
  BookOpen,
} from "lucide-react";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { CalendarHeatmap } from "./calendar-heatmap";
import { SessionAnalytics } from "./session-analytics";
import { SessionAnnotationModal } from "./session-annotation-modal";
import { ProgressionDashboard } from "./progression-dashboard";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { data as gateway } from "@/lib/data/client";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ZeroState } from "@/components/ui/zero-state";
import { ShareSheet } from "@/components/share";
import { buildSessionShareSheetData } from "@/lib/share/session-share";
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
  const [shareSession, setShareSession] = useState<SessionWithDetails | null>(
    null
  );
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<JournalDisplayOptions>({
    showRatings: true,
    showPhotos: true,
  });

  // Fetch user sessions
  const fetchUserSessions = useCallback(async (): Promise<SessionWithDetails[]> => {
    if (!user?.id) return [];
    // Client-safe: fetch via API route, not server actions
    try {
      const result = await gateway.users.sessions.list(user.id, 200);
      return result as SessionWithDetails[];
    } catch (e) {
      console.error("Failed to load user sessions for journal:", e);
      throw e;
    }
  }, [user?.id]);

  const {
    data: sessions,
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useDataFetcher(fetchUserSessions, {
    initialData: [] as SessionWithDetails[],
    skip: !user?.id,
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
    setDisplayOptions((prev: JournalDisplayOptions) => ({ ...prev, viewMode }));
  }, [viewMode]);

  const handleSessionClick = (session: SessionWithDetails) => {
    setSelectedSession(session);
    setShowAnnotationModal(true);
  };

  const handleShareClick = (session: SessionWithDetails) => {
    setShareSession(session);
    setShareSheetOpen(true);
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

  const completedSessions =
    sessions?.filter((session) => session.status === "completed") || [];
  const filteredSessions = completedSessions;

  const totalSessions = completedSessions.length;
  const totalHours =
    completedSessions.reduce((sum, session) => {
      return sum + (session.duration_minutes || 0);
    }, 0) / 60;
  const shareSheetData = shareSession
    ? buildSessionShareSheetData(shareSession)
    : null;

  if (sessionsLoading || analyticsLoading) {
    return <CenteredLoadingSpinner text="Loading your surf journal..." />;
  }

  if (sessionsError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load sessions: {sessionsError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If no sessions, show an inviting empty state instead of an error
  const noSessions = (sessions || []).length === 0;
  if (noSessions) {
    return (
      <ZeroState
        icon={BookOpen}
        title="No Sessions Yet"
        description="Every session you log makes your forecast sharper. Start logging to see your progression and improve forecasts for your community."
        action={{
          label: "Log Your First Session",
          href: "/sessions/new",
          icon: Plus,
        }}
        proTip="Add photos to capture memories and track your progression over time"
      />
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
            <Link href="/sessions/new">
              <Plus className="h-4 w-4 mr-2" />
              Log Session
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
            <p className="text-sm text-muted-foreground">Favorite Beach</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="sessions">
            <Calendar className="h-4 w-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="progression">
            <TrendingUp className="h-4 w-4 mr-2" />
            Progression
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
            </div>
          </div>

          {/* Sessions Display */}
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
                        onClick={() => handleShareClick(session)}
                        aria-label="Share session"
                      >
                        <Share2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handlePrivacyToggle(session.id, !session.is_public)
                        }
                        aria-label={
                          session.is_public
                            ? "Make session private"
                            : "Make session public"
                        }
                      >
                        {session.is_public ? (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSessionClick(session)}
                        aria-label="Open session settings"
                      >
                        <Settings className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <ZeroState
                  icon={BookOpen}
                  title="No Completed Sessions"
                  description="Log your surf sessions to track your progression"
                  action={{
                    label: "Log a Session",
                    href: "/sessions/new",
                    icon: Plus,
                  }}
                />
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

        <TabsContent value="progression" className="space-y-4">
          <ProgressionDashboard />
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

      {/* Share Sheet */}
      {shareSheetData && (
        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={(open) => {
            setShareSheetOpen(open);
            if (!open) setShareSession(null);
          }}
          type="session"
          imageUrl={shareSheetData.imageUrl}
          filename={shareSheetData.filename}
          title={shareSheetData.title}
          text={shareSheetData.text}
          shareUrl={shareSheetData.shareUrl}
        />
      )}
    </div>
  );
}

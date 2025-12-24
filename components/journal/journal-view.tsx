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
  CalendarClock,
  CheckCircle,
  BookOpen,
} from "lucide-react";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { CalendarHeatmap } from "./calendar-heatmap";
import { SessionAnalytics } from "./session-analytics";
import { SessionAnnotationModal } from "./session-annotation-modal";
// Removed dropdown filter in favor of Completed/Planned tabs
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { data as gateway } from "@/lib/data/client";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ZeroState } from "@/components/ui/zero-state";
import { ShareSheet } from "@/components/share";
import { buildSessionShareUrl } from "@/lib/share/build-share-card-url";
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

function clampStars(value: unknown, fallback = 4) {
  const n = typeof value === "number" ? value : Number(value);
  const v = Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(5, Math.round(v)));
}

function ratingLabelFromStars(stars: number) {
  if (stars >= 4) return "Epic";
  if (stars >= 3) return "Good";
  return "Fair";
}

function sizeLabelFromSession(session: SessionWithDetails): string {
  const height = typeof session.wave_height_ft === "number"
    ? session.wave_height_ft
    : Number(session.wave_height_ft);
  if (Number.isFinite(height) && height > 0) {
    if (height < 1) return "Ankle-Knee";
    if (height < 2) return "Waist-Chest";
    if (height < 4) return "Chest-Head";
    if (height < 6) return "Overhead";
    return "Double-Overhead";
  }

  const quality = typeof session.wave_quality === "number"
    ? session.wave_quality
    : Number(session.wave_quality);
  if (Number.isFinite(quality) && quality > 0) {
    if (quality >= 4) return "Overhead";
    if (quality >= 3) return "Chest-Head";
    return "Waist-Chest";
  }

  return "Waist-Chest";
}

function formatShareDate(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  const [sessionFilter, setSessionFilter] = useState<"planned" | "completed">(
    "completed"
  );
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
        description="Start tracking your surf journey by logging your first session"
        action={{
          label: "Log Your First Session",
          href: "/sessions/new?mode=log",
          icon: Plus,
        }}
        secondaryAction={{
          label: "Plan a Session",
          href: "/sessions/new?mode=plan",
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
            <p className="text-sm text-muted-foreground">Favorite Beach</p>
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
                        onClick={() => handleShareClick(session)}
                        aria-label="Share session"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
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
                <ZeroState
                  icon={sessionFilter === "planned" ? CalendarClock : BookOpen}
                  title={
                    sessionFilter === "planned"
                      ? "No Planned Sessions"
                      : "No Completed Sessions"
                  }
                  description={
                    sessionFilter === "planned"
                      ? "Plan your next surf adventure to stay organized"
                      : "Log your surf sessions to track your progression"
                  }
                  action={{
                    label:
                      sessionFilter === "planned"
                        ? "Plan a Session"
                        : "Log a Session",
                    href:
                      sessionFilter === "planned"
                        ? "/sessions/new?mode=plan"
                        : "/sessions/new?mode=log",
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
      {shareSession && (
        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={(open) => {
            setShareSheetOpen(open);
            if (!open) setShareSession(null);
          }}
          type="session"
          imageUrl={buildSessionShareUrl({
            beach:
              shareSession.beach?.name ||
              shareSession.beaches?.name ||
              shareSession.beach_name ||
              "Unknown Beach",
            stars: clampStars(shareSession.rating, 4),
            rating: ratingLabelFromStars(clampStars(shareSession.rating, 4)),
            size: sizeLabelFromSession(shareSession),
            board:
              shareSession.board?.name ||
              shareSession.boards?.name ||
              "Surfboard",
            date: formatShareDate(shareSession.arrival_time ?? shareSession.session_date),
            windLabel: shareSession.wind_direction || undefined,
            windSpeed: (() => {
              const mphRaw = shareSession.wind_speed_mph;
              const mph =
                typeof mphRaw === "number" ? mphRaw : mphRaw ? Number(mphRaw) : NaN;
              return Number.isFinite(mph) ? `${Math.round(mph)} mph` : undefined;
            })(),
            tagline:
              typeof (shareSession as { description?: unknown }).description === "string"
                ? ((shareSession as { description?: string }).description as string)
                : typeof (shareSession as { notes?: unknown }).notes === "string"
                  ? ((shareSession as { notes?: string }).notes as string)
                  : undefined,
            footer: `Similar to your best ${
              shareSession.beach?.name ||
              shareSession.beaches?.name ||
              shareSession.beach_name ||
              "this beach"
            } sessions`,
            bg:
              // Prefer a featured/session photo if available; otherwise default OG background
              (shareSession.featured_photo_url as string | undefined) ||
              (shareSession.image_url as string | undefined) ||
              undefined,
          })}
          filename={`quiver-session-${shareSession.id}`}
          title="Check out my surf session!"
          text={`Just ${shareSession.status === "planned" ? "planned" : "logged"} a session at ${
            shareSession.beach?.name ||
            shareSession.beaches?.name ||
            shareSession.beach_name ||
            "the beach"
          } on Quiver.`}
        />
      )}
    </div>
  );
}

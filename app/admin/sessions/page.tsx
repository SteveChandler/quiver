"use client";

/**
 * Sessions Admin Page
 *
 * Manage and moderate user surf sessions with full admin controls.
 * Features: list, filter, search, view details, soft delete, restore.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarDays,
  Eye,
  Lock,
  Unlock,
  TrendingUp,
  Trash2,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SessionTable } from "@/components/admin/session-table";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  listSessions,
  getSessionStats,
  softDeleteSession,
  restoreSession,
  getSession,
  type AdminSessionListItem,
  type AdminSessionDetails,
} from "@/actions/admin/sessions";
import type { SessionStats } from "@/lib/validation/admin/session-schema";

export default function SessionsAdminPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [showDeleted, setShowDeleted] = useState(false);
  const [sessionToDelete, setSessionToDelete] =
    useState<AdminSessionListItem | null>(null);
  const [sessionToRestore, setSessionToRestore] =
    useState<AdminSessionListItem | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Data fetching - unwrap server action responses
  const fetchSessions = useCallback(async (): Promise<
    AdminSessionListItem[]
  > => {
    const response = await listSessions({ includeDeleted: showDeleted });
    if (!response.success)
      throw new Error(response.error || "Failed to fetch sessions");
    return (response.data as AdminSessionListItem[]) ?? [];
  }, [showDeleted]);

  const fetchStats = useCallback(async (): Promise<SessionStats | null> => {
    const response = await getSessionStats({});
    if (!response.success)
      throw new Error(response.error || "Failed to fetch stats");
    return (response.data as SessionStats) ?? null;
  }, []);

  const fetchSessionDetails =
    useCallback(async (): Promise<AdminSessionDetails | null> => {
      if (!selectedSession) return null;
      const response = await getSession(selectedSession);
      if (!response.success)
        throw new Error(response.error || "Failed to fetch session details");
      return (response.data as AdminSessionDetails) ?? null;
    }, [selectedSession]);

  const {
    data: sessions,
    loading: loadingSessions,
    refetch: refetchSessions,
  } = useDataFetcher<AdminSessionListItem[]>(fetchSessions);
  const {
    data: stats,
    loading: loadingStats,
    refetch: refetchStats,
  } = useDataFetcher<SessionStats | null>(fetchStats);
  const { data: sessionDetails, loading: loadingDetails } =
    useDataFetcher<AdminSessionDetails | null>(fetchSessionDetails);

  // Handlers
  const handleViewDetails = (session: AdminSessionListItem) => {
    setSelectedSession(session.id);
    setDetailsOpen(true);
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;

    try {
      await softDeleteSession(sessionToDelete.id);
      toast({
        title: "Session deleted",
        description: `Session at ${sessionToDelete.beach_name} has been soft deleted.`,
      });
      refetchSessions();
      refetchStats();
      setSessionToDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete session",
        variant: "destructive",
      });
    }
  };

  const handleRestore = async () => {
    if (!sessionToRestore) return;

    try {
      await restoreSession(sessionToRestore.id);
      toast({
        title: "Session restored",
        description: `Session at ${sessionToRestore.beach_name} has been restored.`,
      });
      refetchSessions();
      refetchStats();
      setSessionToRestore(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to restore session",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Session Management"
        description="View and moderate user surf sessions"
      />

      {/* Stats Dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "..." : stats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.logged || 0} logged, {stats?.planned || 0} planned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Public Sessions
            </CardTitle>
            <Unlock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "..." : stats?.public || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.private || 0} private sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats
                ? "..."
                : stats?.avgRating
                ? `${stats.avgRating.toFixed(1)}/5`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalLikes || 0} likes, {stats?.totalComments || 0}{" "}
              comments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deleted</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "..." : stats?.deleted || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Soft deleted sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Sessions</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={(checked) => setShowDeleted(checked === true)}
              />
              <Label
                htmlFor="show-deleted"
                className="text-sm font-normal cursor-pointer"
              >
                Show deleted
              </Label>
            </div>
          </div>
          <CardDescription>
            View and moderate all user surf sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionTable
            sessions={sessions || []}
            onViewDetails={handleViewDetails}
            onDelete={setSessionToDelete}
            onRestore={setSessionToRestore}
            loading={loadingSessions}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmActionDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Session"
        description={
          sessionToDelete
            ? `Are you sure you want to soft delete this session at ${sessionToDelete.beach_name}? The session will be hidden but can be restored later.`
            : ""
        }
        actionLabel="Delete Session"
        actionVariant="destructive"
      />

      {/* Restore Confirmation Dialog */}
      <ConfirmActionDialog
        open={!!sessionToRestore}
        onOpenChange={(open) => !open && setSessionToRestore(null)}
        onConfirm={handleRestore}
        title="Restore Session"
        description={
          sessionToRestore
            ? `Are you sure you want to restore this session at ${sessionToRestore.beach_name}?`
            : ""
        }
        actionLabel="Restore Session"
      />

      {/* Session Details Sheet (Investigation Mode) */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Session Details</SheetTitle>
            <SheetDescription>
              Complete session information for support and investigation
            </SheetDescription>
          </SheetHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">
                Loading session details...
              </div>
            </div>
          ) : sessionDetails ? (
            <div className="mt-6 space-y-6">
              {/* User Info */}
              <div>
                <h3 className="text-sm font-semibold mb-2">User Information</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Name:</span>{" "}
                    {sessionDetails.profiles?.display_name ||
                      sessionDetails.profiles?.full_name ||
                      "Unknown"}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span>{" "}
                    {sessionDetails.profiles?.email}
                  </div>
                  <div>
                    <span className="font-medium">User ID:</span>{" "}
                    <code className="text-xs">{sessionDetails.user_id}</code>
                  </div>
                </div>
              </div>

              {/* Beach Info */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Beach Information
                </h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Beach:</span>{" "}
                    {sessionDetails.beaches?.name || sessionDetails.beach_name}
                  </div>
                  <div>
                    <span className="font-medium">Region:</span>{" "}
                    {sessionDetails.beaches?.region}
                  </div>
                  <div>
                    <span className="font-medium">Beach ID:</span>{" "}
                    <code className="text-xs">{sessionDetails.beach_id}</code>
                  </div>
                </div>
              </div>

              {/* Session Details */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Session Details</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    {sessionDetails.status}
                  </div>
                  <div>
                    <span className="font-medium">Arrival:</span>{" "}
                    {new Date(sessionDetails.arrival_time).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>{" "}
                    {sessionDetails.duration_minutes} minutes
                  </div>
                  <div>
                    <span className="font-medium">Visibility:</span>{" "}
                    {sessionDetails.is_public ? "Public" : "Private"}
                  </div>
                </div>
              </div>

              {/* Ratings */}
              {sessionDetails.rating && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Ratings</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-medium">Overall:</span>{" "}
                      {sessionDetails.rating}/5
                    </div>
                    {sessionDetails.wave_quality && (
                      <div>
                        <span className="font-medium">Wave Quality:</span>{" "}
                        {sessionDetails.wave_quality}/5
                      </div>
                    )}
                    {sessionDetails.crowd_level && (
                      <div>
                        <span className="font-medium">Crowd Level:</span>{" "}
                        {sessionDetails.crowd_level}/5
                      </div>
                    )}
                    {sessionDetails.parking_ease && (
                      <div>
                        <span className="font-medium">Parking:</span>{" "}
                        {sessionDetails.parking_ease}/5
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description & Notes */}
              {(sessionDetails.description || sessionDetails.notes) && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Notes</h3>
                  {sessionDetails.description && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Description:
                      </span>
                      <p className="text-sm mt-1">
                        {sessionDetails.description}
                      </p>
                    </div>
                  )}
                  {sessionDetails.notes && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Private Notes:
                      </span>
                      <p className="text-sm mt-1">{sessionDetails.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Goals */}
              {sessionDetails.goals && sessionDetails.goals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Goals</h3>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {sessionDetails.goals.map((goal: string, i: number) => (
                      <li key={i}>{goal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Media */}
              {sessionDetails.session_media &&
                sessionDetails.session_media.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Photos ({sessionDetails.session_media.length})
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {sessionDetails.session_media.map((media: any) => (
                        <div
                          key={media.id}
                          className="relative aspect-square rounded-lg overflow-hidden"
                        >
                          <Image
                            src={media.public_url}
                            alt={media.caption || "Session photo"}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Engagement */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Engagement</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Likes:</span>{" "}
                    {sessionDetails.likes_count}
                  </div>
                  <div>
                    <span className="font-medium">Comments:</span>{" "}
                    {sessionDetails.comments_count}
                  </div>
                </div>
              </div>

              {/* Raw JSON (for advanced debugging) */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Raw Session Data</h3>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(sessionDetails, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              No session details available
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

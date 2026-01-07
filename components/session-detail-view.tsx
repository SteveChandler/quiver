"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Star,
  MapPin,
  Calendar,
  Clock,
  Waves,
  Thermometer,
  Users,
  Edit,
  Trash2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
// import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import type { SessionWithDetails } from "@/types/database";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SessionComments } from "@/components/session-comments";
import { ForecastComparison } from "@/components/session/forecast-comparison";
import { parseForecastSnapshot } from "@/types/forecast-snapshot";
import dynamic from "next/dynamic";
import { MapImage } from "@/components/map-image";
import { getSessionMapImageUrl } from "@/lib/utils/session-utils";
import type { SessionPhoto } from "@/lib/supabase/storage";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

// Dynamically import SessionPhotoGallery to avoid SSR issues
const SessionPhotoGallery = dynamic(
  () => import("@/components/media/session-photo-gallery"),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
);

interface SessionDetailViewProps {
  id: string;
}

export function SessionDetailView({ id }: SessionDetailViewProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sessionPhotos, setSessionPhotos] = useState<SessionPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!user) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/sessions/${id}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setError(json?.error || "Failed to load session");
          return;
        }

        const nextSession = (json?.data?.session || null) as SessionWithDetails | null;
        if (!nextSession) {
          setError("Session not found");
          return;
        }
        setSession(nextSession);

        // Load session photos (client-safe API route)
        setPhotosLoading(true);
        try {
          const photosRes = await fetch(`/api/sessions/${id}/photos`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          const photosJson = await photosRes.json().catch(() => null);
          if (photosRes.ok) {
            setSessionPhotos((photosJson?.data || []) as SessionPhoto[]);
          } else {
            console.error("Error loading session photos:", photosJson?.error || photosRes.status);
          }
        } finally {
          setPhotosLoading(false);
        }
      } catch (error) {
        console.error("Error loading session:", error);
        setError("Failed to load session");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [id, user]);

  // Gate the detail page for logged-out users (avoid infinite loading state).
  if (!user && !isLoading) {
    return (
      <PublicContentGate
        ctaTitle="Log in to view session details"
        ctaDescription="See the full session breakdown, photos, and comments."
        blurLevel="lg"
        source="session-detail"
        className="flex-1"
      >
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 bg-background border-b">
            <div className="container flex items-center h-16 px-4">
              <Link href="/sessions" className="mr-2">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-bold">Session Details</h1>
            </div>
          </header>
          <main className="flex-1 container px-4 py-6 space-y-4">
            <Card>
              <CardContent className="p-6 space-y-2">
                <div className="h-4 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-40 w-full bg-muted rounded" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-5/6 bg-muted rounded" />
              </CardContent>
            </Card>
          </main>
        </div>
      </PublicContentGate>
    );
  }

  const handleDelete = async () => {
    if (!user) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        router.push("/profile");
      } else {
        const json = await res.json().catch(() => null);
        console.error("Failed to delete session:", json?.error || res.status);
        setError("Failed to delete session");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      setError("Failed to delete session");
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkAsCompleted = () => {
    if (session) {
      // Route to log-session page with prefill parameter
      router.push(`/sessions/new?mode=log&convert=${session.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-background border-b">
          <div className="container flex items-center h-16 px-4">
            <Link href="/profile" className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">Session Details</h1>
          </div>
        </header>
        <main className="flex-1 container px-4 py-6">
          <Alert variant="destructive">
            <AlertDescription>{error || "Session not found"}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button asChild>
              <Link href="/profile">Back to Profile</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Use arrival_time for both planned and completed sessions
  const arrivalTime = session.arrival_time
    ? new Date(session.arrival_time)
    : null;
  const formattedDate = arrivalTime?.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = arrivalTime?.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Check if this is a planned session
  const isPlannedSession = session?.status === "planned";

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Link href="/profile" className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Session Details</h1>
              {isPlannedSession && (
                <div className="flex items-center gap-1 mt-1">
                  <Calendar className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">
                    Planned Session
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mark as Completed button - only for planned sessions */}
            {isPlannedSession && (
              <Button
                size="sm"
                onClick={handleMarkAsCompleted}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Completed
              </Button>
            )}

            <Button size="icon" variant="ghost" asChild>
              <Link href={`/sessions/new?mode=log&edit=${session.id}`}>
                <Edit className="h-5 w-5" />
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Session</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this session? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto pb-20">
        {/* Add planned session notice */}
        {isPlannedSession && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">Planned Session</p>
                  <p className="text-sm text-blue-700">
                    This session is planned for {formattedDate}. Click “Mark as
                    Completed” to log the details of your actual session.
                  </p>
                  {session.notes && (
                    <div className="mt-2 p-2 bg-blue-100 rounded text-sm">
                      <p className="font-medium text-blue-800">
                        Planned Notes:
                      </p>
                      <p className="text-blue-700">{session.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Image/Map - Show map for all sessions, photos as additional content */}
        <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden">
          <MapImage
            src={getSessionMapImageUrl(session)}
            alt={`Map of ${session.beach?.name || "session location"}`}
            latitude={session.beach?.lat ?? undefined}
            longitude={session.beach?.lon ?? undefined}
            fill={true}
            className="object-cover"
            beachName={
              session.beach?.name || session.beach_name || "Session Location"
            }
          />
        </div>

        {/* Session Info */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {session.beach?.name || "Unknown Beach"}
            </h2>
            <div className="flex">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < (session.rating ?? 0)
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300"
                    }`}
                  />
                ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                {session.beach
                  ? getBeachLocation(session.beach)
                  : "Unknown Location"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formattedTime}</span>
            </div>
          </div>

          {session.description && (
            <Card>
              <CardContent className="p-4">
                <p>{session.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Always show board for planned sessions, conditions only for completed */}
            {session.board && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-6 w-6 text-primary flex items-center justify-center">
                    🏄
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {isPlannedSession ? "Planned Board" : "Board"}
                    </p>
                    <p className="font-medium">{session.board.name}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Duration for planned sessions */}
            {isPlannedSession && session.duration_minutes && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Planned Duration
                    </p>
                    <p className="font-medium">
                      {Math.floor(session.duration_minutes / 60)}h{" "}
                      {session.duration_minutes % 60}m
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conditions only for completed sessions */}
            {!isPlannedSession && session.wave_height_ft && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Waves className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Wave Height</p>
                    <p className="font-medium">{session.wave_height_ft}ft</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isPlannedSession && session.water_temp && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Thermometer className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Water Temp</p>
                    <p className="font-medium">{session.water_temp}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isPlannedSession && session.crowd_level && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Users className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Crowd</p>
                    <div className="flex">
                      {Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < (session.crowd_level ?? 0)
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Forecast Comparison - Only for completed sessions with snapshot data */}
        {!isPlannedSession && session.forecast_snapshot && (() => {
          const parsedSnapshot = parseForecastSnapshot(session.forecast_snapshot);
          return parsedSnapshot ? (
            <ForecastComparison snapshot={parsedSnapshot} />
          ) : null;
        })()}

        {/* Session Photos */}
        {!photosLoading &&
          (sessionPhotos.length > 0 || user?.id === session.user_id) && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Session Photos</h3>
                <SessionPhotoGallery
                  sessionId={session.id}
                  photos={sessionPhotos}
                  canEdit={user?.id === session.user_id}
                  showMetadata={true}
                  onPhotosChange={setSessionPhotos}
                />
              </CardContent>
            </Card>
          )}

        {/* Comments Section */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Comments</h3>
            <SessionComments sessionId={session.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

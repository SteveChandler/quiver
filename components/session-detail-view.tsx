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
  Share2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
// import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import type { SessionWithDetails } from "@/types/database";
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
import { ShareSheet } from "@/components/share";
import { buildSessionShareSheetData } from "@/lib/share/session-share";
import { getWaveTypeLabel } from "@/components/ui/wave-type-selector";
import { formatSessionTideSnapshot } from "@/lib/services/session-tide-snapshot";
import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import {
  getFirstTouchPlatform,
  type FirstTouchPlatform,
} from "@/lib/analytics/web-context";

const RIP_CURRENT_LABELS: Record<string, string> = {
  none: "None",
  light: "Light",
  strong: "Strong",
};

const RIP_RISK_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

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

interface SharedSessionPreview {
  rating: number | null;
  title: string;
  subtitle: string;
  imageUrl: string | null;
}

interface SessionDetailViewProps {
  id: string;
  sharedPreview?: SharedSessionPreview | null;
}

export function SessionDetailView({ id, sharedPreview = null }: SessionDetailViewProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [nativeCtaPlatform, setNativeCtaPlatform] =
    useState<FirstTouchPlatform>("desktop");
  const [sessionPhotos, setSessionPhotos] = useState<SessionPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  useEffect(() => {
    setNativeCtaPlatform(getFirstTouchPlatform());
  }, []);
  const sharedPreviewStars =
    sharedPreview?.rating != null
      ? Math.max(0, Math.min(5, Math.round(sharedPreview.rating)))
      : null;
  const signInHref = `/auth/sign-in?redirectTo=${encodeURIComponent(`/sessions/${id}`)}`;

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
      <div className="flex-1 flex flex-col bg-[#F4EBD8] text-[#11100D]">
        <header className="sticky top-0 z-10 border-b border-[#E5D4B3] bg-[#F4EBD8]/95 backdrop-blur">
          <div className="container flex items-center h-16 px-4">
            <Link href="/sessions" className="mr-2" aria-label="Back to sessions">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">Session Details</h1>
          </div>
        </header>
        <main className="flex-1 container px-4 py-6">
          <Card className="mx-auto max-w-md overflow-hidden border-[#E5D4B3] bg-white shadow-sm">
            {sharedPreview?.imageUrl ? (
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#252D6B]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sharedPreview.imageUrl}
                  alt={
                    sharedPreview.title
                      ? `Shared session: ${sharedPreview.title}`
                      : "Shared surf session"
                  }
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8A5E00]">
                  Shared session
                </p>
                <h2 className="text-2xl font-black leading-tight">
                  {sharedPreview?.title ?? "Open this session in Quiver"}
                </h2>
                <p className="text-sm font-semibold text-[#4A463C]">
                  {sharedPreview?.subtitle ??
                    "See the beach, conditions, photos, and session notes in the app."}
                </p>
              </div>

              {sharedPreviewStars != null ? (
                <div
                  aria-label={`${sharedPreviewStars} out of 5 stars`}
                  className="text-2xl text-[#F78E42]"
                >
                  {"★".repeat(sharedPreviewStars)}
                  {"☆".repeat(5 - sharedPreviewStars)}
                </div>
              ) : null}

              <div className="rounded-2xl border border-[#E5D4B3] bg-[#F4EBD8] p-4 text-sm font-semibold text-[#4A463C]">
                Quiver opens shared session links directly in the app when it is installed.
                If it is not installed, get Quiver and reopen this link.
              </div>

              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link href={signInHref}>Sign in to view on web</Link>
                </Button>
                <NativeAppFunnelCta
                  platform={nativeCtaPlatform}
                  source="session_share"
                  surface="session_detail_fallback"
                  placement="primary_app_store"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#F78E42] px-4 py-2 text-sm font-medium text-[#252D6B] transition-colors hover:bg-[#D06C2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  desktopClassName="w-full"
                  desktopShowEmailForm
                  iosLabel="Get Quiver"
                  androidLabel="Get the Android beta"
                />
                <Button asChild variant="outline" className="w-full border-[#E5D4B3]">
                  <Link href="/download">Download options</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
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

  const shareData = buildSessionShareSheetData(session);
  const waveCharacteristics =
    (session as { wave_characteristics?: string[] | null }).wave_characteristics ?? [];
  const tideRateFtPerHr =
    (session as { tide_rate_ft_per_hr?: number | null }).tide_rate_ft_per_hr ?? null;
  const tideDisplay =
    session.tide_height_ft !== null &&
    session.tide_height_ft !== undefined &&
    session.tide_status &&
    tideRateFtPerHr !== null
      ? formatSessionTideSnapshot({
          tideHeightFt: session.tide_height_ft,
          tideStatus: session.tide_status as "rising" | "falling" | "high" | "low",
          tideRateFtPerHr,
        })
      : null;
  const ripCurrentObserved =
    (session as { rip_current_observed?: string | null }).rip_current_observed ?? null;
  const ripCurrentLabel = ripCurrentObserved
    ? RIP_CURRENT_LABELS[ripCurrentObserved] ?? ripCurrentObserved
    : null;
  const ripCurrentRisk =
    (session as { rip_current_risk?: string | null }).rip_current_risk ?? null;
  const ripRiskLabel = ripCurrentRisk
    ? RIP_RISK_LABELS[ripCurrentRisk] ?? ripCurrentRisk
    : null;

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
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShareOpen(true)}
              aria-label="Share session"
            >
              <Share2 className="h-5 w-5" aria-hidden="true" />
            </Button>
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
                  aria-label="Delete session"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
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

          {waveCharacteristics.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Wave Characteristics</p>
                <div className="flex flex-wrap gap-2">
                  {waveCharacteristics.map((characteristic) => (
                    <span
                      key={characteristic}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                    >
                      {getWaveTypeLabel(characteristic)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            {session.board && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-6 w-6 text-primary flex items-center justify-center">
                    🏄
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Board</p>
                    <p className="font-medium">{session.board.name}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {session.duration_minutes && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">
                      {Math.floor(session.duration_minutes / 60)}h{" "}
                      {session.duration_minutes % 60}m
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {session.wave_height_ft && (
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

            {session.water_temp && (
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

            {tideDisplay && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tide</p>
                    <p className="font-medium">{tideDisplay}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {ripCurrentLabel && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Waves
                    className={`h-6 w-6 ${
                      ripCurrentObserved === "none"
                        ? "text-primary"
                        : "text-amber-600"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Rip current observed
                    </p>
                    <p
                      className={`font-medium ${
                        ripCurrentObserved === "none"
                          ? ""
                          : "text-amber-700"
                      }`}
                    >
                      {ripCurrentLabel}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {ripRiskLabel && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Waves
                    className={`h-6 w-6 ${
                      ripCurrentRisk === "high"
                        ? "text-amber-600"
                        : "text-primary"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Rip risk that day
                    </p>
                    <p
                      className={`font-medium ${
                        ripCurrentRisk === "high" ? "text-amber-700" : ""
                      }`}
                    >
                      {ripRiskLabel}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {session.crowd_level && (
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

        {/* Forecast Comparison */}
        {session.forecast_snapshot && (() => {
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

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        type="session"
        imageUrl={shareData.imageUrl}
        filename={shareData.filename}
        title={shareData.title}
        text={shareData.text}
        shareUrl={shareData.shareUrl}
      />
    </div>
  );
}

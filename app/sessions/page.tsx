"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Waves, Sparkles, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { trackPublicPageView } from "@/lib/analytics";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

type SessionFeedItem = {
  id: string;
  beachName: string;
  createdAt?: string;
  arrivalTime?: string;
  description?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  likesCount?: number | null;
  waveHeight?: number | string | null;
  waveQuality?: number | string | null;
  rating?: number | null;
  authorName?: string | null;
  authorAvatar?: string | null;
};

export default function SessionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Track public page view for guest users
    if (!isLoading && !user) {
      trackPublicPageView("sessions-feed");
    }
  }, [user, isLoading]);

  const fetchSessions = useCallback(async (): Promise<SessionFeedItem[]> => {
    // Guests should see public sessions immediately, even while auth is initializing.
    // Authenticated users should see their own sessions using the existing API.
    const endpoint = user?.id
      ? `/api/users/${encodeURIComponent(user.id)}/sessions?limit=20`
      : "/api/sessions/public?page=1&limit=10";

    const res = await fetch(endpoint, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        json?.error ||
        (typeof json?.details === "string" ? json.details : null) ||
        `Failed to fetch sessions (${res.status})`;
      throw new Error(message);
    }

    const rawItems: any[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.data?.sessions)
        ? json.data.sessions
        : Array.isArray(json?.sessions)
          ? json.sessions
          : [];

    return rawItems.map((s: any): SessionFeedItem => {
      const beachName =
        s?.beachName ||
        s?.beach_name ||
        s?.beach?.name ||
        s?.beach_name ||
        "Unknown Beach";

      const authorName =
        s?.author?.name ||
        s?.user?.full_name ||
        s?.user?.username ||
        null;

      const authorAvatar =
        s?.author?.avatar ||
        s?.user?.avatar_url ||
        null;

      return {
        id: String(s?.id),
        beachName,
        createdAt: s?.createdAt || s?.created_at || undefined,
        arrivalTime: s?.arrivalTime || s?.arrival_time || undefined,
        description: s?.description ?? null,
        notes: s?.notes ?? null,
        imageUrl: s?.imageUrl || s?.image_url || null,
        likesCount: s?.likesCount ?? s?.likes_count ?? 0,
        waveHeight:
          s?.waveHeight ?? s?.wave_height_ft ?? s?.wave_height ?? null,
        waveQuality: s?.waveQuality ?? s?.wave_quality ?? null,
        rating: typeof s?.rating === "number" ? s.rating : null,
        authorName,
        authorAvatar,
      };
    });
  }, [user?.id]);

  const {
    data: sessionsData,
    loading: sessionsLoading,
    error: sessionsError,
    retry: retrySessions,
  } = useDataFetcher(fetchSessions, { immediate: true, initialData: [] });

  const sessions = useMemo(() => sessionsData ?? [], [sessionsData]);
  const showIdentity = Boolean(user);
  const gatedContent = useMemo(() => {
    if (sessionsLoading && sessions.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="loading-spinner" />
          <span>Loading sessions…</span>
        </div>
      );
    }

    if (sessionsError) {
      return (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-red-600">{sessionsError}</p>
            <Button onClick={retrySessions} variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!sessionsLoading && sessions.length === 0) {
      return (
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              No public sessions yet.
            </p>
            {!showIdentity ? (
              <p className="text-sm text-muted-foreground">
                Be the first—sign up and log a session.
              </p>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="block hover:opacity-90 transition-opacity"
          >
            <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="bg-gradient-to-r from-ocean-blue/10 to-blue-100/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {showIdentity && session.authorAvatar ? (
                      <Image
                        src={session.authorAvatar}
                        alt={session.authorName || "Surfer avatar"}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-ocean-blue/20" />
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {showIdentity ? session.authorName || "Surfer" : "Surfer"}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {session.beachName}
                        {session.createdAt ? (
                          <>
                            {" "}
                            • {new Date(session.createdAt).toLocaleDateString()}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {/* Rating is intentionally hidden for logged-out visitors */}
                  {showIdentity && typeof session.rating === "number" ? (
                    <div className="flex items-center gap-1">
                      {[...Array(Math.round(session.rating))].map((_, idx) => (
                        <Sparkles
                          key={idx}
                          className="h-4 w-4 text-yellow-500 fill-yellow-500"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {session.imageUrl ? (
                  <Image
                    src={session.imageUrl}
                    alt={`Session at ${session.beachName}`}
                    width={1200}
                    height={900}
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="w-full rounded-lg mb-4 max-h-96 object-cover"
                  />
                ) : null}

                <p className="text-muted-foreground mb-4">
                  {session.description ||
                    session.notes ||
                    `Great session at ${session.beachName}!`}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>❤️ {session.likesCount || 0} likes</span>
                  {session.waveHeight ? <span>🌊 {session.waveHeight}</span> : null}
                  {session.waveQuality ? (
                    <span>⭐ {session.waveQuality}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    );
  }, [sessionsLoading, sessionsError, retrySessions, sessions, showIdentity]);

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
          ctaTitle="See what your crew has been surfing"
          ctaDescription="Sign up to view session logs and connect with local surfers"
          blurLevel="lg"
          source="sessions-feed"
          className="min-h-[600px]"
        >
          {gatedContent}
        </PublicContentGate>

        {/* Floating Log Session button for authenticated users */}
        {user && !isLoading && (
          <Link href="/sessions/new?mode=log">
            <Button
              size="lg"
              className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 shadow-lg bg-ocean-blue hover:bg-ocean-blue/90 h-14 px-6 rounded-full"
              data-testid="log-session-btn"
            >
              <Plus className="h-5 w-5 mr-2" />
              Log Session
            </Button>
          </Link>
        )}

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

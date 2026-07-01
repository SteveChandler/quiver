"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  UserRound,
  Waves,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { trackPublicPageView } from "@/lib/analytics";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { QuiverSticker, ZineSurface } from "@/components/zine";

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

function getSessionCreatedDateLabel(session: SessionFeedItem): string | null {
  if (!session.createdAt) {
    return null;
  }

  const date = new Date(session.createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString();
}

function formatSessionValue(value: number | string): string {
  if (typeof value === "number") {
    return String(value);
  }

  return value;
}

export default function SessionsPage(): ReactElement {
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
        <div className="torn torn-tb flex min-h-40 items-center gap-4 border-2 border-[#11100D] bg-[#FBF6E8] text-[#11100D]">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-[#11100D]/25 border-t-[#11100D]"
            aria-hidden
          />
          <div>
            <p className="typewriter mb-1">Fetching logbook</p>
            <p className="text-sm leading-relaxed text-[#11100D]/70">
              Loading sessions...
            </p>
          </div>
        </div>
      );
    }

    if (sessionsError) {
      return (
        <div className="torn torn-tb space-y-4 border-2 border-[#11100D] bg-[#FBF6E8] text-[#11100D]">
          <div>
            <p className="typewriter mb-2">Signal dropped</p>
            <p className="text-sm leading-relaxed text-[#B91C1C]">
              {sessionsError}
            </p>
          </div>
          <Button
            onClick={retrySessions}
            variant="outline"
            className="border-2 border-[#11100D] bg-[#F4EBD8] font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] hover:bg-[#F0E5CC]"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Try again
          </Button>
        </div>
      );
    }

    if (!sessionsLoading && sessions.length === 0) {
      return (
        <div className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8] text-[#11100D]">
          <p className="typewriter mb-2">No entries yet</p>
          <p className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
            No public sessions yet.
          </p>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#11100D]/70">
            {!showIdentity ? (
              <p>
                Be the first - sign up and log a session.
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5" data-testid="session-feed-list">
        {sessions.map((session, index) => {
          const authorLabel = showIdentity
            ? session.authorName || "Surfer"
            : "Surfer";
          const createdDateLabel = getSessionCreatedDateLabel(session);

          return (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="group block text-[#11100D] transition-transform hover:-translate-y-1"
            >
              <article
                className={`torn torn-tb overflow-hidden border-2 border-[#11100D] ${
                  index % 2 === 0 ? "bg-[#FBF6E8]" : "bg-[#F0E5CC]"
                }`}
                data-testid="session-card"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {showIdentity && session.authorAvatar ? (
                        <Image
                          src={session.authorAvatar}
                          alt={session.authorName || "Surfer avatar"}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-full border-2 border-[#11100D] object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42]/30">
                          <UserRound className="h-6 w-6" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="font-heading text-xl font-black uppercase leading-tight text-[#11100D]">
                          {authorLabel}
                        </h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/62">
                          <span>{session.beachName}</span>
                          {createdDateLabel ? (
                            <>
                              <span aria-hidden>/</span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays
                                  className="h-3.5 w-3.5"
                                  aria-hidden
                                />
                                {createdDateLabel}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {/* Rating is intentionally hidden for logged-out visitors */}
                    {showIdentity && typeof session.rating === "number" ? (
                      <div className="flex shrink-0 items-center gap-1">
                        {[...Array(Math.round(session.rating))].map((_, idx) => (
                          <Sparkles
                            key={idx}
                            className="h-4 w-4 fill-[#FDB84B] text-[#11100D]"
                            aria-hidden
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {session.imageUrl ? (
                    <div className="polaroid rot-1">
                      <div className="photo" style={{ aspectRatio: "16 / 9" }}>
                        <Image
                          src={session.imageUrl}
                          alt={`Session at ${session.beachName}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 768px"
                          className="object-cover object-center saturate-[0.9]"
                        />
                      </div>
                      <p className="cap">{session.beachName}</p>
                    </div>
                  ) : null}

                  <p className="text-base leading-relaxed text-[#11100D]/74">
                    {session.description ||
                      session.notes ||
                      `Great session at ${session.beachName}!`}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-[#11100D]/70">
                    <span className="inline-flex items-center gap-1 border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-1">
                      <Heart className="h-3.5 w-3.5" aria-hidden />
                      {session.likesCount || 0} likes
                    </span>
                    {session.waveHeight ? (
                      <span className="inline-flex items-center gap-1 border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-1">
                        <Waves className="h-3.5 w-3.5" aria-hidden />
                        {formatSessionValue(session.waveHeight)}
                      </span>
                    ) : null}
                    {session.waveQuality ? (
                      <span className="inline-flex items-center gap-1 border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-1">
                        <Star className="h-3.5 w-3.5" aria-hidden />
                        {formatSessionValue(session.waveQuality)}
                      </span>
                    ) : null}
                    <span className="ml-auto inline-flex items-center gap-1 text-[#B56A2B] transition-colors group-hover:text-[#11100D]">
                      Open log
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    );
  }, [sessionsLoading, sessionsError, retrySessions, sessions, showIdentity]);

  // Public users see session feed preview
  return (
    <ZineSurface
      sectionLabel="Sessions"
      editionLabel={showIdentity ? "Your logbook" : "Public feed preview"}
      data-testid="sessions-zine-surface"
    >
      <main>
        <header className="grid gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-end">
          <div className="relative">
            <QuiverSticker
              sticker="blogSessionLog"
              className="absolute -top-10 right-2 hidden w-28 rotate-6 drop-shadow-md sm:block"
            />
            <p className="label-black mb-5">Surf logbook</p>
            <h1 className="zine-h1 font-heading font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              Community Sessions
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
              See what surfers are logging in your area.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
              <span>{showIdentity ? "Your feed" : "Public preview"}</span>
              <span aria-hidden>/</span>
              <span>Session notes</span>
              <span aria-hidden>/</span>
              <span>Local breaks</span>
            </div>
          </div>

          <div className="torn torn-tb rot-2 relative border-2 border-[#11100D] bg-[#F0E5CC]">
            <QuiverSticker
              sticker="creamTape"
              className="absolute -top-7 left-8 w-28 -rotate-6 opacity-90"
            />
            <p className="typewriter mb-3">Field notes</p>
            <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
              Paddle-outs, conditions, and the local story.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#11100D]/70">
              Guests get a blurred public feed preview. Signed-in surfers keep
              the full logbook, ratings, and quick session links.
            </p>
          </div>
        </header>

        {/* Public content gate for session feed */}
        <section className="mt-10" aria-label="Session feed">
          <PublicContentGate
            ctaTitle="See what your crew has been surfing"
            ctaDescription="Sign up to view session logs and connect with local surfers"
            blurLevel="lg"
            source="sessions-feed"
            className="min-h-[600px] overflow-hidden border-2 border-[#11100D] bg-[#F0E5CC] p-4 shadow-[2px_3px_0_rgba(17,16,13,0.22)] sm:p-5"
          >
            {gatedContent}
          </PublicContentGate>
        </section>

        {/* Floating Log Session button for authenticated users */}
        {user && !isLoading && (
          <Link href="/sessions/new?mode=log">
            <Button
              size="lg"
              className="fixed bottom-24 right-4 z-50 h-14 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-6 font-heading font-bold text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.35)] hover:bg-[#F78E42]/90 md:bottom-8 md:right-8"
              data-testid="log-session-btn"
            >
              <Plus className="mr-2 h-5 w-5" aria-hidden />
              Log Session
            </Button>
          </Link>
        )}

        {/* Call to action */}
        <section className="torn torn-tb rot-neg mt-10 border-2 border-[#11100D] bg-[#FBF6E8] px-6 pb-12 pt-10 text-center text-[#11100D] sm:px-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42]/35">
            <Waves className="h-9 w-9" aria-hidden />
          </div>
          <h2 className="font-heading text-2xl font-black uppercase leading-tight">
            Ready to join the community?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#11100D]/70">
            Log your sessions, get forecasts, find surf buddies, and build your
            surf journal.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              onClick={() => router.push("/auth/sign-up")}
              className="border-2 border-[#11100D] bg-[#F78E42] font-heading font-bold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.28)] hover:bg-[#F78E42]/90"
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              Sign Up
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/auth/sign-in")}
              className="border-2 border-[#11100D] bg-[#F4EBD8] font-heading font-bold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.18)] hover:bg-[#F0E5CC]"
            >
              Sign In
            </Button>
          </div>
        </section>
      </main>
    </ZineSurface>
  );
}

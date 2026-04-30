"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { SessionWithDetails } from "@/types/database";
import { HalftonePhoto, DoodleStar } from "./atoms";

interface ZineRecentSessionsProps {
  beachId: string;
}

const ROTATIONS = ["rotate(-1.6deg)", "rotate(1.4deg)", "rotate(-0.8deg)"];

interface ZineSessionsBundle {
  sessions: SessionWithDetails[];
  approvedPhotos: string[];
}

/**
 * Recent sessions polaroid clippings — replaces the legacy best-of photos
 * gallery. Calls the canonical `/api/beaches/[id]/sessions` endpoint with
 * `publicOnly=true` so private sessions never leak to anonymous viewers.
 *
 * When a session has no photo, falls back to the curated `beach_photos`
 * (the same approved photos that power the photo gallery) so polaroids
 * always have a real image instead of a placeholder.
 *
 * Renders nothing if zero rows so we don't show "No sessions yet" — the
 * design relies on social proof, and an empty section signals an inactive
 * community.
 */
export function ZineRecentSessions({ beachId }: ZineRecentSessionsProps) {
  const fetchBundle = useCallback(async (): Promise<ZineSessionsBundle> => {
    const [sessionsRes, photosResult] = await Promise.all([
      fetch(`/api/beaches/${beachId}/sessions?limit=3&publicOnly=true`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      // Approved beach photos (third-party + admin-approved) — used as polaroid
      // fallbacks when sessions don't have their own photo.
      (async () => {
        try {
          const { getBestBeachPhotosAction } = await import("@/actions/beach-media-actions");
          const result = await getBestBeachPhotosAction(beachId, 6);
          if (result && Array.isArray(result.data)) {
            return result.data
              .map((p: { public_url?: string | null }) => p.public_url)
              .filter((u: unknown): u is string => typeof u === "string" && u.length > 0);
          }
        } catch {
          // Fail silently — polaroids will use a placeholder
        }
        return [] as string[];
      })(),
    ]);

    const sessions = (sessionsRes?.data?.sessions ?? sessionsRes?.sessions ?? []) as SessionWithDetails[];
    return { sessions, approvedPhotos: photosResult };
  }, [beachId]);

  const { data, loading } = useDataFetcher(fetchBundle, {
    immediate: true,
    initialData: { sessions: [], approvedPhotos: [] },
  });
  const sessions = data?.sessions ?? [];
  const approvedPhotos = data?.approvedPhotos ?? [];

  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
    <section className="mt-9" aria-label="Recent sessions">
      <div className="flex items-end gap-3.5 mb-4">
        <div className="label-black" style={{ fontSize: 16 }}>
          RECENT SESSIONS
        </div>
        <div
          className="hidden md:block"
          style={{
            fontFamily: "var(--font-handwritten), cursive",
            fontSize: 26,
            color: "#11100D",
            fontWeight: 700,
            transform: "rotate(-2deg)",
            lineHeight: 1,
          }}
          aria-hidden
        >
          from the crew →
        </div>
      </div>

      <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
        {sessions.slice(0, 3).map((s, i) => (
          <SessionPolaroid
            key={s.id}
            session={s}
            rotation={ROTATIONS[i] ?? "rotate(0deg)"}
            fallbackPhoto={approvedPhotos[i] ?? approvedPhotos[0] ?? null}
          />
        ))}
      </div>
    </section>
  );
}

function SessionPolaroid({
  session,
  rotation,
  fallbackPhoto,
}: {
  session: SessionWithDetails;
  rotation: string;
  fallbackPhoto: string | null;
}) {
  const initials = getInitials(session.profiles?.full_name ?? session.user?.full_name);
  const displayName = (session.profiles?.full_name ?? session.user?.full_name ?? "Surfer").split(" ").slice(0, 2).join(" ");
  const photoSrc = session.featured_photo_url || session.image_url || fallbackPhoto || null;
  const caption = truncate(session.notes || session.description || "", 70) || "logged a session";
  const rating = typeof session.rating === "number" ? Math.max(0, Math.min(5, Math.round(session.rating))) : 0;
  const when = session.created_at
    ? new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return (
    <article className="polaroid relative" style={{ transform: rotation }}>
      <span className="tape tl" aria-hidden />
      <div className="photo">
        <HalftonePhoto src={photoSrc} alt={photoSrc ? `${displayName} session photo` : undefined} height={170} />
      </div>
      <div className="flex items-center gap-2 mt-2 px-1">
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "#0B3A75",
            color: "#F4EBD8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          {initials}
        </div>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 700, color: "#11100D" }}>
          {displayName}
        </span>
        <span className="ml-auto" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "#11100D", opacity: 0.7 }}>
          {when}
        </span>
      </div>
      <div className="cap mt-2" style={{ lineHeight: 1.2 }}>
        &ldquo;{caption}&rdquo;
      </div>
      {rating > 0 && (
        <div className="flex gap-px justify-center mt-2" aria-label={`${rating} of 5 stars`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <DoodleStar key={i} size={12} color="#0B3A75" filled={i < rating} />
          ))}
        </div>
      )}
    </article>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "··";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

import { formatWindSpeed } from "@/lib/formatters/surf-data";
import { buildSessionShareUrl } from "@/lib/share/build-share-card-url";
import type { SessionWithDetails } from "@/types/database";

export interface SessionShareSheetData {
  imageUrl: string;
  filename: string;
  title: string;
  text: string;
  shareUrl: string;
}

export function clampSessionStars(value: unknown, fallback = 4) {
  const n = typeof value === "number" ? value : Number(value);
  const v = Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(5, Math.round(v)));
}

export function getSessionBeachName(session: SessionWithDetails): string {
  return (
    session.beach?.name ||
    session.beaches?.name ||
    session.beach_name ||
    "Unknown Beach"
  );
}

function getSessionBoardName(session: SessionWithDetails): string {
  return session.board?.name || session.boards?.name || "Surfboard";
}

function ratingLabelFromStars(stars: number) {
  if (stars >= 4) return "Epic";
  if (stars >= 3) return "Good";
  return "Fair";
}

function sizeLabelFromSession(session: SessionWithDetails): string {
  const height =
    typeof session.wave_height_ft === "number"
      ? session.wave_height_ft
      : Number(session.wave_height_ft);
  if (Number.isFinite(height) && height > 0) {
    if (height < 1) return "Ankle-Knee";
    if (height < 2) return "Waist-Chest";
    if (height < 4) return "Chest-Head";
    if (height < 6) return "Overhead";
    return "Double-Overhead";
  }

  const quality =
    typeof session.wave_quality === "number"
      ? session.wave_quality
      : Number(session.wave_quality);
  if (Number.isFinite(quality) && quality > 0) {
    if (quality >= 4) return "Overhead";
    if (quality >= 3) return "Chest-Head";
    return "Waist-Chest";
  }

  return "Waist-Chest";
}

function formatSessionShareDate(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getSessionWindSpeed(session: SessionWithDetails): string | undefined {
  const mphRaw = session.wind_speed_mph;
  const mph =
    typeof mphRaw === "number" ? mphRaw : mphRaw ? Number(mphRaw) : NaN;
  return Number.isFinite(mph) ? formatWindSpeed(mph) : undefined;
}

function getSessionTagline(session: SessionWithDetails): string | undefined {
  if (typeof session.description === "string" && session.description.trim()) {
    return session.description;
  }

  const notes = (session as { notes?: unknown }).notes;
  return typeof notes === "string" && notes.trim() ? notes : undefined;
}

function getSessionBackground(session: SessionWithDetails): string | undefined {
  const imageUrl = (session as { image_url?: unknown }).image_url;
  return (
    session.featured_photo_url ||
    (typeof imageUrl === "string" && imageUrl ? imageUrl : undefined)
  );
}

function getShareBaseUrl() {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-restricted-properties -- Need origin for share URL building, not navigation
    return window.location.origin;
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://quiversurf.app"
  );
}

export function buildSessionPageShareUrl(sessionId: string): string {
  return new URL(`/sessions/${encodeURIComponent(sessionId)}`, getShareBaseUrl())
    .toString();
}

export function buildSessionShareImageUrl(
  session: SessionWithDetails
): string {
  const beachName = getSessionBeachName(session);
  const stars = clampSessionStars(session.rating, 4);
  const footerBeach =
    beachName === "Unknown Beach" ? "this beach" : beachName;

  return buildSessionShareUrl({
    beach: beachName,
    stars,
    rating: ratingLabelFromStars(stars),
    size: sizeLabelFromSession(session),
    board: getSessionBoardName(session),
    date: formatSessionShareDate(session.arrival_time ?? session.session_date),
    windLabel: session.wind_direction || undefined,
    windSpeed: getSessionWindSpeed(session),
    tagline: getSessionTagline(session),
    footer: `Similar to your best ${footerBeach} sessions`,
    bg: getSessionBackground(session),
  });
}

export function buildSessionShareSheetData(
  session: SessionWithDetails
): SessionShareSheetData {
  const beachName = getSessionBeachName(session);
  const shareBeach = beachName === "Unknown Beach" ? "the beach" : beachName;
  const verb = session.status === "planned" ? "planned" : "logged";

  return {
    imageUrl: buildSessionShareImageUrl(session),
    filename: `quiver-session-${session.id}`,
    title: "Check out my surf session!",
    text: `Just ${verb} a session at ${shareBeach} on Quiver.`,
    shareUrl: buildSessionPageShareUrl(session.id),
  };
}

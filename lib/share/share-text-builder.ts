/**
 * Share Text Builder
 * Generates formatted text for social media sharing
 */

import type { SessionWithDetails } from "@/types/database";
import type { ShareTextData } from "@/types/session-share";
import { format } from "date-fns";

/**
 * Format wave height for display
 * Handles various input formats and provides fallback
 */
function formatWaveHeight(session: SessionWithDetails): string {
  // Try to get wave height from session data
  const waveQuality = session.wave_quality;

  // If wave_quality exists, use it to estimate height range
  if (waveQuality !== null && waveQuality !== undefined) {
    const ranges: Record<number, string> = {
      1: "1-2 ft",
      2: "2-3 ft",
      3: "3-4 ft",
      4: "4-6 ft",
      5: "6-8 ft",
    };
    return ranges[waveQuality] || "varying";
  }

  // Check session notes for wave height mentions
  const notes = session.notes || session.description || "";
  const heightMatch = notes.match(/(\d+)-(\d+)\s*ft/i);
  if (heightMatch) {
    return `${heightMatch[1]}-${heightMatch[2]} ft`;
  }

  return "varying";
}

/**
 * Format wind conditions for display
 */
function formatWind(session: SessionWithDetails): string {
  // Check session notes for wind mentions
  const notes = session.notes || session.description || "";

  // Look for wind speed patterns like "5-10 mph" or "light" or "offshore"
  const windSpeedMatch = notes.match(/(\d+)-(\d+)\s*mph/i);
  if (windSpeedMatch) {
    return `${windSpeedMatch[1]}-${windSpeedMatch[2]} mph`;
  }

  // Look for wind direction/description
  const windDescMatch = notes.match(
    /(offshore|onshore|light|moderate|strong|gusty)/i
  );
  if (windDescMatch) {
    return windDescMatch[1].toLowerCase();
  }

  return "light";
}

/**
 * Format date for share text
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, "MMM d, yyyy");
  } catch {
    return "Recently";
  }
}

/**
 * Format rating as stars
 */
export function formatRatingAsStars(rating: number | null): string {
  if (rating === null || rating < 0 || !isFinite(rating)) return "";
  const fullStars = "⭐".repeat(Math.floor(rating));
  return fullStars;
}

/**
 * Extract share text data from session
 */
export function extractShareTextData(
  session: SessionWithDetails
): ShareTextData {
  const beachName = session.beaches?.name || "Unknown Beach";
  const date = formatDate(session.arrival_time);
  const waveHeight = formatWaveHeight(session);
  const wind = formatWind(session);
  const rating = session.rating || 0;

  return {
    beachName,
    date,
    waveHeight,
    wind,
    rating,
  };
}

/**
 * Build share text for social media
 * Template: "{Beach} • {Date} • {Waves}, {Wind} ⭐{Rating}/5 — Track your sessions at quiversurf.app"
 */
export function buildShareText(session: SessionWithDetails): string {
  const data = extractShareTextData(session);
  const stars = formatRatingAsStars(data.rating);

  return `${data.beachName} • ${data.date} • ${data.waveHeight}, ${data.wind} ${stars}${data.rating}/5 — Track your sessions at quiversurf.app`;
}

/**
 * Build shorter share text for platforms with character limits (Twitter/X)
 * Template: "{Beach} • {Date} • ⭐{Rating}/5"
 * Max length: ~250 chars (leaving room for URL ~23 chars + space = ~280 total)
 */
export function buildShortShareText(session: SessionWithDetails): string {
  const data = extractShareTextData(session);
  const stars = formatRatingAsStars(data.rating);
  
  // Base template: " • {Date} • {stars}{rating}/5" ≈ 20-25 chars
  const baseTemplate = ` • ${data.date} • ${stars}${data.rating}/5`;
  const maxBeachNameLength = 250 - baseTemplate.length;
  
  // Truncate beach name if too long
  const beachName = data.beachName.length > maxBeachNameLength
    ? data.beachName.substring(0, maxBeachNameLength - 3) + "..."
    : data.beachName;

  return `${beachName}${baseTemplate}`;
}

/**
 * Build Instagram-specific caption
 * More casual, with hashtags
 */
export function buildInstagramCaption(session: SessionWithDetails): string {
  const data = extractShareTextData(session);
  const stars = formatRatingAsStars(data.rating);

  return `${data.beachName} 🌊
${data.date}
${data.waveHeight} waves, ${data.wind}
${stars}${data.rating}/5

Track your sessions at quiversurf.app 📱

#surfing #surf #surfer #waves #ocean #beachlife #surflife #quiversurf`;
}

/**
 * Build tooltip text for Instagram link sticker
 */
export function buildInstagramLinkStickerTooltip(
  sessionId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app"
): string {
  const shareUrl = `${baseUrl}/s/${sessionId}`;
  return `Add Link Sticker → ${shareUrl}`;
}

/**
 * Build session description for share page
 */
export function buildSessionDescription(session: SessionWithDetails): string {
  const notes = session.notes || session.description;
  if (notes) {
    // Truncate to 160 characters for meta description (test requirement)
    return notes.length > 160 ? notes.substring(0, 157) + "..." : notes;
  }

  const data = extractShareTextData(session);
  const description = `Surf session at ${data.beachName} on ${data.date}. ${data.waveHeight} waves with ${data.wind} wind. Rating: ${data.rating}/5`;
  // Ensure description doesn't exceed 160 characters
  return description.length > 160 ? description.substring(0, 157) + "..." : description;
}

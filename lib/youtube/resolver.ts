import type {
  YouTubeChannelListResponse,
  YouTubeSearchListResponse,
} from "./types";
import { YouTubeApiError } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Fetch with retry for transient errors (429, 5xx).
 * Throws YouTubeApiError immediately for 403 (quota exceeded) and 4xx.
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url);

    if (response.ok) return response;

    if (response.status === 403) {
      throw new YouTubeApiError(response.status, `YouTube API quota exceeded: ${response.statusText}`);
    }

    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    throw new YouTubeApiError(response.status, `YouTube API error: ${response.status} ${response.statusText}`);
  }

  throw new YouTubeApiError(0, "Max retries exceeded");
}

/**
 * Extract a YouTube video ID from a watch URL.
 * Returns null for non-YouTube URLs, youtube.com/live/ URLs, or invalid input.
 */
export function extractVideoIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.searchParams.has("v")
    ) {
      return u.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a YouTube channel handle (e.g. "@ExploreOceans") to a channel ID.
 * Returns null if the channel is not found.
 * Throws YouTubeApiError on API errors (quota exceeded, network failure).
 *
 * Note: If YouTube deprecates the `forHandle` parameter, a fallback approach
 * is to use `search?q={channelName}&type=channel` (costs 100 units vs 1 unit).
 */
export async function resolveChannelId(handle: string, apiKey: string): Promise<string | null> {
  const url = `${YOUTUBE_API_BASE}/channels?forHandle=${encodeURIComponent(handle)}&part=id&key=${apiKey}`;
  const response = await fetchWithRetry(url);
  const data: YouTubeChannelListResponse = await response.json();
  return data.items?.[0]?.id ?? null;
}

/**
 * Find currently live streams for a YouTube channel.
 * Returns an array of { videoId, title } for each live stream.
 * Throws YouTubeApiError on API errors.
 */
export async function findLiveStreams(
  channelId: string,
  apiKey: string
): Promise<Array<{ videoId: string; title: string }>> {
  const url = `${YOUTUBE_API_BASE}/search?channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&part=snippet&key=${apiKey}`;
  const response = await fetchWithRetry(url);
  const data: YouTubeSearchListResponse = await response.json();
  return (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
  }));
}

/**
 * Match a live stream to a beach using a title hint.
 * - If titleHint is provided and non-empty, find the stream whose title contains it (case-insensitive).
 * - If titleHint is null/undefined/empty, return the first live stream.
 * - Returns null if no match or empty list.
 */
export function matchStreamToBeach(
  liveVideos: Array<{ videoId: string; title: string }>,
  titleHint: string | null | undefined
): { videoId: string; title: string } | null {
  if (liveVideos.length === 0) return null;
  if (!titleHint) return liveVideos[0];
  const hint = titleHint.toLowerCase();
  return liveVideos.find((v) => v.title.toLowerCase().includes(hint)) ?? null;
}

/**
 * Build a standard YouTube watch URL from a video ID.
 * Always uses youtube.com/watch?v= format (not youtube.com/live/)
 * because buildCamEmbed only handles the watch?v= pattern.
 */
export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// app/api/cron/resolve-youtube-cams/route.ts

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  validateCronRequest,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/middleware/api-wrappers";
import {
  resolveChannelId,
  findLiveStreams,
  matchStreamToBeach,
  extractVideoIdFromUrl,
  buildYouTubeWatchUrl,
} from "@/lib/youtube/resolver";
import { YouTubeApiError } from "@/lib/youtube/types";
import type { YouTubeCamRow, CamUpdateResult } from "@/lib/youtube/types";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface YouTubeOutcome {
  updated?: number;
  processed?: number;
  [key: string]: unknown;
}

async function recordYouTubeOutcome(result: YouTubeOutcome): Promise<YouTubeOutcome> {
  return withCronOutcome(
    {
      job: "/api/cron/resolve-youtube-cams",
      unit: "cams_updated",
      expectedMin: 1,
      getProduced: (value) => value.updated ?? 0,
      legitimatelyZero: (value) =>
        value.skip_reason === "config_missing"
          ? { reason: "YOUTUBE_API_KEY is not configured" }
          : value.processed === 0
            ? { reason: "No YouTube camera rows were available to resolve" }
            : undefined,
    },
    async () => result,
  );
}

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return createSuccessResponse(await recordYouTubeOutcome({
        status: "skipped",
        skip_reason: "config_missing",
        message: "YOUTUBE_API_KEY not set",
        processed: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        cleared: 0,
        results: [],
        duration: `${Date.now() - startTime}ms`,
      }));
    }

    const supabase = createSupabaseServiceRoleClient();

    // 1. Query all YouTube cam rows
    const { data: camRows, error: queryError } = await supabase
      .from("beach_sources")
      .select("beach_id, camera_url, youtube_channel_handle, youtube_channel_id, youtube_stream_title_hint, youtube_last_resolved_at")
      .not("youtube_channel_handle", "is", null);

    if (queryError) {
      return createErrorResponse("Database error", queryError.message, 500);
    }

    if (!camRows || camRows.length === 0) {
      return createSuccessResponse(await recordYouTubeOutcome({
        message: "No YouTube cams to resolve",
        processed: 0,
        updated: 0,
        duration: `${Date.now() - startTime}ms`,
      }));
    }

    const typedRows = camRows as YouTubeCamRow[];

    // 2. Group by unique channel handle
    const channelMap = new Map<string, YouTubeCamRow[]>();
    for (const row of typedRows) {
      const handle = row.youtube_channel_handle;
      if (!channelMap.has(handle)) channelMap.set(handle, []);
      channelMap.get(handle)!.push(row);
    }

    const results: CamUpdateResult[] = [];

    // 3. Process each unique channel
    for (const [handle, beaches] of channelMap) {
      try {
        // Resolve channel ID if not cached
        let channelId = beaches[0].youtube_channel_id;
        if (!channelId) {
          channelId = await resolveChannelId(handle, apiKey);
          if (!channelId) {
            console.warn(`[resolve-youtube-cams] Channel not found: ${handle}`);
            for (const beach of beaches) {
              results.push({ beachId: beach.beach_id, channelHandle: handle, action: "skipped", reason: "Channel not found" });
            }
            continue;
          }
          // Cache the channel ID for all beaches using this channel
          const beachIds = beaches.map((b) => b.beach_id);
          await supabase
            .from("beach_sources")
            .update({ youtube_channel_id: channelId })
            .in("beach_id", beachIds);
        }

        // Find live streams
        const liveVideos = await findLiveStreams(channelId, apiKey);

        if (liveVideos.length === 0) {
          // Channel is temporarily offline.  If it's been offline for >48 hours,
          // clear the camera_url so users see the "No live cam" fallback instead
          // of YouTube's broken player.  The URL will be restored automatically
          // on the next run once the channel goes live again.
          const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

          for (const beach of beaches) {
            const lastResolved = beach.youtube_last_resolved_at
              ? new Date(beach.youtube_last_resolved_at).getTime()
              : 0;
            const isStale = Date.now() - lastResolved > STALE_THRESHOLD_MS;

            if (isStale && beach.camera_url) {
              await supabase
                .from("beach_sources")
                .update({ camera_url: null })
                .eq("beach_id", beach.beach_id);
              results.push({ beachId: beach.beach_id, channelHandle: handle, action: "cleared", reason: "No live streams for >48h" });
            } else {
              results.push({ beachId: beach.beach_id, channelHandle: handle, action: "skipped", reason: "No live streams" });
            }
          }
          continue;
        }

        // Match live streams to each beach
        for (const beach of beaches) {
          const match = matchStreamToBeach(liveVideos, beach.youtube_stream_title_hint);

          if (!match) {
            results.push({ beachId: beach.beach_id, channelHandle: handle, action: "skipped", reason: "No title hint match" });
            continue;
          }

          const currentVideoId = extractVideoIdFromUrl(beach.camera_url);
          const newUrl = buildYouTubeWatchUrl(match.videoId);

          if (currentVideoId === match.videoId) {
            // Same video — just update timestamp
            await supabase
              .from("beach_sources")
              .update({ youtube_last_resolved_at: new Date().toISOString() })
              .eq("beach_id", beach.beach_id);
            results.push({ beachId: beach.beach_id, channelHandle: handle, action: "unchanged" });
          } else {
            // Video ID changed — update camera_url + thumbnail
            await supabase
              .from("beach_sources")
              .update({
                camera_url: newUrl,
                thumbnail_url: `https://img.youtube.com/vi/${match.videoId}/hqdefault.jpg`,
                youtube_last_resolved_at: new Date().toISOString(),
              })
              .eq("beach_id", beach.beach_id);

            console.log(`[resolve-youtube-cams] Updated ${handle}: ${currentVideoId} -> ${match.videoId}`);
            results.push({
              beachId: beach.beach_id,
              channelHandle: handle,
              action: "updated",
              oldVideoId: currentVideoId ?? undefined,
              newVideoId: match.videoId,
            });
          }
        }
      } catch (err) {
        // Quota exceeded (403) — abort entire run immediately
        if (err instanceof YouTubeApiError && err.status === 403) {
          console.error(`[resolve-youtube-cams] Quota exceeded, aborting: ${err.message}`);
          return createErrorResponse("Quota exceeded", { results, error: err.message }, 500);
        }

        const message = err instanceof Error ? err.message : String(err);
        console.error(`[resolve-youtube-cams] Error processing ${handle}: ${message}`);
        for (const beach of beaches) {
          results.push({ beachId: beach.beach_id, channelHandle: handle, action: "skipped", reason: message });
        }
      }
    }

    const updated = results.filter((r) => r.action === "updated").length;
    const unchanged = results.filter((r) => r.action === "unchanged").length;
    const skipped = results.filter((r) => r.action === "skipped").length;
    const cleared = results.filter((r) => r.action === "cleared").length;

    return createSuccessResponse(await recordYouTubeOutcome({
      processed: results.length,
      updated,
      unchanged,
      skipped,
      cleared,
      results,
      duration: `${Date.now() - startTime}ms`,
    }));
  } catch (error) {
    console.error("[resolve-youtube-cams] Unexpected error:", error);
    return createErrorResponse("Cron failed", { error: String(error) }, 500);
  }
}

// Allow manual POST trigger
async function _POST(request: Request): Promise<Response> {
  return _GET(request);
}

export const GET = withObservedCron("/api/cron/resolve-youtube-cams", _GET);
export const POST = withObservedCron("/api/cron/resolve-youtube-cams", _POST);

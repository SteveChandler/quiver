/** YouTube Data API v3 channel lookup response (channels.list?part=id) */
export interface YouTubeChannelListResponse {
  items?: Array<{
    id: string;
  }>;
}

/** YouTube Data API v3 search response (search.list?part=snippet&eventType=live) */
export interface YouTubeSearchListResponse {
  items?: Array<{
    id: {
      videoId: string;
    };
    snippet: {
      title: string;
      channelId: string;
      channelTitle: string;
    };
  }>;
}

/** Typed error for YouTube API failures — carries HTTP status for structured error handling */
export class YouTubeApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

/** A beach_sources row with YouTube resolver columns */
export interface YouTubeCamRow {
  beach_id: string;
  camera_url: string | null;
  youtube_channel_handle: string;
  youtube_channel_id: string | null;
  youtube_stream_title_hint: string | null;
  youtube_last_resolved_at: string | null;
}

/** Result of updating a single beach's camera URL */
export interface CamUpdateResult {
  beachId: string;
  channelHandle: string;
  action: "updated" | "unchanged" | "skipped";
  oldVideoId?: string;
  newVideoId?: string;
  reason?: string;
}

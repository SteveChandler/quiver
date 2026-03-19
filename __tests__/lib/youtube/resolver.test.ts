import {
  resolveChannelId,
  findLiveStreams,
  matchStreamToBeach,
  extractVideoIdFromUrl,
  buildYouTubeWatchUrl,
} from "@/lib/youtube/resolver";
import { YouTubeApiError } from "@/lib/youtube/types";

// --- extractVideoIdFromUrl ---

describe("extractVideoIdFromUrl", () => {
  it("extracts ID from youtube.com/watch?v= URL", () => {
    expect(extractVideoIdFromUrl("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("extracts ID from youtu.be/ URL", () => {
    expect(extractVideoIdFromUrl("https://youtu.be/abc123")).toBe("abc123");
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractVideoIdFromUrl("https://hdontap.com/stream/123")).toBeNull();
  });

  it("returns null for youtube.com/live/ URL (unsupported by buildCamEmbed)", () => {
    expect(extractVideoIdFromUrl("https://www.youtube.com/live/abc123")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(extractVideoIdFromUrl(null)).toBeNull();
    expect(extractVideoIdFromUrl(undefined)).toBeNull();
  });
});

// --- buildYouTubeWatchUrl ---

describe("buildYouTubeWatchUrl", () => {
  it("builds a standard watch URL from a video ID", () => {
    expect(buildYouTubeWatchUrl("abc123")).toBe("https://www.youtube.com/watch?v=abc123");
  });

  it("never produces youtube.com/live/ format", () => {
    expect(buildYouTubeWatchUrl("abc123")).not.toContain("/live/");
  });
});

// --- resolveChannelId ---

describe("resolveChannelId", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  it("returns channel ID on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: "UC_test123" }] }),
    });

    const result = await resolveChannelId("@TestChannel", "fake-key");
    expect(result).toBe("UC_test123");
  });

  it("returns null when channel not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await resolveChannelId("@NonExistent", "fake-key");
    expect(result).toBeNull();
  });

  it("throws YouTubeApiError on 403 (quota exceeded)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    await expect(resolveChannelId("@Test", "fake-key")).rejects.toThrow(YouTubeApiError);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    try {
      await resolveChannelId("@Test", "fake-key");
    } catch (e) {
      expect(e).toBeInstanceOf(YouTubeApiError);
      expect((e as YouTubeApiError).status).toBe(403);
    }
  });

  it("retries on 5xx errors before throwing", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Service Unavailable" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "UC_retry" }] }) });

    const result = await resolveChannelId("@RetryChannel", "fake-key");
    expect(result).toBe("UC_retry");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// --- findLiveStreams ---

describe("findLiveStreams", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  it("returns live video IDs and titles", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: { videoId: "vid1" }, snippet: { title: "Beach Camera", channelId: "UC1", channelTitle: "Test" } },
          { id: { videoId: "vid2" }, snippet: { title: "Surf Camera", channelId: "UC1", channelTitle: "Test" } },
        ],
      }),
    });

    const result = await findLiveStreams("UC1", "fake-key");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ videoId: "vid1", title: "Beach Camera" });
    expect(result[1]).toEqual({ videoId: "vid2", title: "Surf Camera" });
  });

  it("returns empty array when no live streams", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await findLiveStreams("UC1", "fake-key");
    expect(result).toEqual([]);
  });
});

// --- matchStreamToBeach ---

describe("matchStreamToBeach", () => {
  const liveVideos = [
    { videoId: "vid1", title: "Beach Camera - Deerfield Beach, Florida" },
    { videoId: "vid2", title: "Surf Camera - Deerfield Beach, Florida USA" },
    { videoId: "vid3", title: "Underwater Camera - Deerfield Beach, Florida" },
  ];

  it("matches by title hint (case-insensitive)", () => {
    const result = matchStreamToBeach(liveVideos, "Surf Camera");
    expect(result?.videoId).toBe("vid2");
  });

  it("returns first result when no title hint", () => {
    const result = matchStreamToBeach(liveVideos, null);
    expect(result?.videoId).toBe("vid1");
  });

  it("returns null when title hint matches nothing", () => {
    const result = matchStreamToBeach(liveVideos, "Pier Camera");
    expect(result).toBeNull();
  });

  it("returns null for empty video list", () => {
    const result = matchStreamToBeach([], null);
    expect(result).toBeNull();
  });

  it("treats empty string title hint like null (returns first)", () => {
    const result = matchStreamToBeach(liveVideos, "");
    expect(result?.videoId).toBe("vid1");
  });
});

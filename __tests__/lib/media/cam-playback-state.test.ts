import { buildCamEmbed, getCamPlaybackState } from "@/lib/media/cam-embed";
import { resolveCamPlayback } from "@/lib/media/cam-embed-preflight";
import { isLiveCamBeach, sortLiveCamBeachesFirst } from "@/lib/media/cam-directory";

describe("getCamPlaybackState", () => {
  it("treats players the beach page renders as inline", () => {
    expect(getCamPlaybackState(buildCamEmbed("https://hls.cdn-surfline.com/oregon/cam/playlist.m3u8"), true)).toEqual({ kind: "inline" });
    expect(getCamPlaybackState(buildCamEmbed("https://www.portofbrookingsharbor.com/webcam"), true)).toEqual({ kind: "inline" });
    expect(getCamPlaybackState(buildCamEmbed("https://www.seabrookwa.com/live-weather-cam/"), true)).toEqual({ kind: "inline" });
  });

  it("keeps an iframe inline when the preflight could not read headers, as the beach page still tries it", () => {
    expect(getCamPlaybackState(buildCamEmbed("https://www.seabrookwa.com/live-weather-cam/"), null)).toEqual({ kind: "inline" });
  });

  it("returns none for an iframe the preflight refused", () => {
    expect(getCamPlaybackState(buildCamEmbed("https://cbccstaff.net/whats-new/webcam/"), false)).toEqual({ kind: "none" });
  });

  it("names the provider for link-out cams", () => {
    expect(getCamPlaybackState(buildCamEmbed("https://www.sigward.com/"), false)).toEqual({
      kind: "external",
      provider: "Muir Beach Webcam",
      pageUrl: "https://www.sigward.com/",
    });
  });

  it("returns none when there is no camera", () => {
    expect(getCamPlaybackState(buildCamEmbed(null), null)).toEqual({ kind: "none" });
  });
});

describe("resolveCamPlayback", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockHead(status: number, headers: Record<string, string> = {}): jest.Mock {
    const fetchMock = jest.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(headers),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("matches the beach page for a camera page that refuses HEAD (Cannon Beach)", async () => {
    mockHead(405);
    await expect(resolveCamPlayback("https://cbccstaff.net/whats-new/webcam/")).resolves.toEqual({ kind: "none" });
  });

  it("returns none when the page forbids framing", async () => {
    mockHead(200, { "x-frame-options": "SAMEORIGIN" });
    await expect(resolveCamPlayback("https://example.com/cam")).resolves.toEqual({ kind: "none" });
  });

  it("stays inline when the HEAD request fails, matching the optimistic beach page", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(resolveCamPlayback("https://www.seabrookwa.com/live-weather-cam/")).resolves.toEqual({ kind: "inline" });
  });

  it("returns none for an offline Surfline stream, as the sources route drops it", async () => {
    mockHead(404);
    await expect(resolveCamPlayback("https://hls.cdn-surfline.com/oregon/cam/playlist.m3u8")).resolves.toEqual({ kind: "none" });
  });

  it("keeps a Surfline stream live when its check times out", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    await expect(resolveCamPlayback("https://hls.cdn-surfline.com/oregon/cam/playlist.m3u8")).resolves.toEqual({ kind: "inline" });
  });

  it("returns none for a Surfline stream that fails for a reason other than a timeout", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("fetch failed: redirect");
    }) as unknown as typeof fetch;
    await expect(resolveCamPlayback("https://hls.cdn-surfline.com/oregon/cam/playlist.m3u8")).resolves.toEqual({ kind: "none" });
  });

  it("does not probe provider-only cams", async () => {
    const fetchMock = mockHead(500);
    await expect(resolveCamPlayback("https://www.sigward.com/")).resolves.toMatchObject({ kind: "external" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("cam directory helpers", () => {
  it("counts inline and provider cams as live, not forecast-only spots", () => {
    expect(isLiveCamBeach({ playback: { kind: "inline" } })).toBe(true);
    expect(isLiveCamBeach({ playback: { kind: "external", provider: "X", pageUrl: "https://x.example/" } })).toBe(true);
    expect(isLiveCamBeach({ playback: { kind: "none" } })).toBe(false);
  });

  it("sorts forecast-only spots after live cams and keeps order", () => {
    const beaches = [
      { id: "a", playback: { kind: "none" as const } },
      { id: "b", playback: { kind: "inline" as const } },
      { id: "c", playback: { kind: "external" as const, provider: "X", pageUrl: "https://x.example/" } },
    ];
    expect(sortLiveCamBeachesFirst(beaches).map((b) => b.id)).toEqual(["b", "c", "a"]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "@/app/api/beaches/[id]/sources/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The camera preflight is cached per URL with unstable_cache, which needs a Next request context.
jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data: unknown) => ({
    status: 200,
    headers: { set: jest.fn() },
    json: async () => ({ success: true, data }),
  })),
  handleApiError: jest.fn(async () => ({
    status: 500,
    headers: { set: jest.fn() },
    json: async () => ({
      success: false,
      error: "Failed to fetch beach sources",
    }),
  })),
}));

const mockCreateSupabaseServerClient = createSupabaseServerClient as jest.Mock;
const VALID_BEACH_UUID = "11111111-1111-4111-8111-111111111111";

interface QueryChain {
  select: jest.Mock<QueryChain, [string]>;
  eq: jest.Mock<QueryChain, [string, unknown]>;
  order: jest.Mock<QueryChain, [string]>;
  limit: jest.Mock<QueryChain, [number]>;
  maybeSingle: jest.Mock<Promise<unknown>, []>;
}

function makeChain(result: unknown): QueryChain {
  const chain = {} as QueryChain;
  chain.select = jest.fn<QueryChain, [string]>(() => chain);
  chain.eq = jest.fn<QueryChain, [string, unknown]>(() => chain);
  chain.order = jest.fn<QueryChain, [string]>(() => chain);
  chain.limit = jest.fn<QueryChain, [number]>(() => chain);
  chain.maybeSingle = jest.fn<Promise<unknown>, []>(async () => result);
  return chain;
}

describe("GET /api/beaches/[id]/sources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([true, false])("sanitizes retired camera and thumbnail fields (camera retired: %s)", async (retired) => {
    const sourceChain = makeChain({
      data: {
        beach_id: VALID_BEACH_UUID,
        forecast_source_id: "forecast",
        camera_url: retired ? "https://portal.hdontap.com/s/embed" : "https://www.obhotel.com/Webcam-Oceanbeach.php",
        thumbnail_url: "https://storage.hdontap.com/still.jpg",
      },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue({ from: (table: string) => table === "beach_sources" ? sourceChain : dioramaChain });
    const url = new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`);
    const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected upstream request"));
    const response = await GET({ url: url.href, nextUrl: url } as any, { params: Promise.resolve({ id: VALID_BEACH_UUID }) });
    const body = await response.json();
    expect(body.data.sources).toMatchObject({
      forecast_source_id: "forecast",
      camera_url: retired ? null : "https://www.obhotel.com/Webcam-Oceanbeach.php",
      cam_open_url: retired ? null : "https://www.obhotel.com/Webcam-Oceanbeach.php",
      cam_kind: retired ? "none" : "hdontap",
      cam_embed: null,
      cam_thumbnail_url: null,
      embed_allowed: retired ? null : true,
    });
    expect(JSON.stringify(body)).not.toMatch(/\.hdontap\.com/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns an absolute compatible HLS URL for the native HDRelay player", async () => {
    const sourceChain = makeChain({ data: { beach_id: VALID_BEACH_UUID, camera_url: "https://watch.hdrelay.io/live/cam/index.m3u8" }, error: null });
    const dioramaChain = makeChain({ data: null, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue({ from: jest.fn((table: string) => table === "beach_sources" ? sourceChain : dioramaChain) });
    const request = { url: "https://www.quiversurf.app/api/beaches/" + VALID_BEACH_UUID + "/sources", nextUrl: new URL("https://www.quiversurf.app/api/beaches/" + VALID_BEACH_UUID + "/sources") };
    const response = await GET(request as any, { params: Promise.resolve({ id: VALID_BEACH_UUID }) });
    const body = await response.json();
    expect(body.data.sources.camera_url).toBe("https://www.quiversurf.app/api/hls-proxy/watch.hdrelay.io/live/cam/index.m3u8");
    expect(body.data.sources.cam_kind).toBe("hls");
    expect(body.data.sources.embed_allowed).toBe(true);
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/beaches/[id]/sources/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  it("preserves web fields and exposes native-friendly cam fields", async () => {
    const sourceChain = makeChain({
      data: {
        beach_id: VALID_BEACH_UUID,
        forecast_source_id: "forecast-1",
        camera_url: "https://cams.example/blacks",
        thumbnail_url: "https://cams.example/blacks.jpg",
      },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beach_sources") return sourceChain;
        if (table === "beach_dioramas") return dioramaChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const request = {
      nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`),
    };

    const response = await GET(request as any, {
      params: Promise.resolve({ id: VALID_BEACH_UUID }),
    });

    const body = await response.json();

    expect(body.data.sources).toMatchObject({
      beach_id: VALID_BEACH_UUID,
      forecast_source_id: "forecast-1",
      camera_url: "https://cams.example/blacks",
      cam_open_url: "https://cams.example/blacks",
      cam_thumbnail_url: "https://cams.example/blacks.jpg",
      cam_kind: expect.any(String),
    });
  });

  it.each([
    "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67",
    "https://flaglersurf.com/webcam/",
    "https://www.corollalightresort.com/surf-cam/",
  ])("marks %s as an external link-out", async (cameraUrl) => {
    const sourceChain = makeChain({
      data: {
        beach_id: VALID_BEACH_UUID,
        forecast_source_id: null,
        camera_url: cameraUrl,
        thumbnail_url: null,
      },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beach_sources") return sourceChain;
        if (table === "beach_dioramas") return dioramaChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await GET(
      {
        nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`),
      } as any,
      {
        params: Promise.resolve({ id: VALID_BEACH_UUID }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.sources).toMatchObject({
      camera_url: cameraUrl,
      cam_open_url: cameraUrl,
      cam_kind: "external",
      embed_allowed: false,
    });
  });

  it.each([
    [
      "https://www.youtube.com/watch?v=abc123",
      { kind: "iframe", src: "https://www.youtube.com/embed/abc123?rel=0&autoplay=1&mute=1", provider: "youtube", title: "Live Cam" },
    ],
    [
      "https://flaglersurf.com/webcam/",
      { kind: "external", pageUrl: "https://flaglersurf.com/webcam/", provider: "Flagler Surf" },
    ],
    ["https://cdn.example.com/cam.mp4", null],
    ["http://cams.example.com/blacks", null],
  ])("returns cam_embed for %s", async (cameraUrl, expected) => {
    const sourceChain = makeChain({
      data: { beach_id: VALID_BEACH_UUID, forecast_source_id: null, camera_url: cameraUrl, thumbnail_url: null },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => (table === "beach_sources" ? sourceChain : dioramaChain)),
    });
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const response = await GET(
      { nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`) } as any,
      { params: Promise.resolve({ id: VALID_BEACH_UUID }) },
    );
    const body = await response.json();

    expect(body.data.sources.cam_embed).toEqual(expected);
  });

  it("returns cam_embed null when the beach has no camera", async () => {
    const sourceChain = makeChain({ data: null, error: null });
    const dioramaChain = makeChain({ data: null, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => (table === "beach_sources" ? sourceChain : dioramaChain)),
    });
    const response = await GET(
      { nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`) } as any,
      { params: Promise.resolve({ id: VALID_BEACH_UUID }) },
    );
    const body = await response.json();
    expect(body.data.sources.cam_embed).toBeNull();
  });

  it("exposes Surfline HLS cams when the playlist health check returns 200", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
    } as Response);
    const sourceChain = makeChain({
      data: {
        beach_id: VALID_BEACH_UUID,
        forecast_source_id: null,
        camera_url: "https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8",
        thumbnail_url:
          "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
      },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beach_sources") return sourceChain;
        if (table === "beach_dioramas") return dioramaChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await GET(
      {
        nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`),
      } as any,
      {
        params: Promise.resolve({ id: VALID_BEACH_UUID }),
      }
    );

    const body = await response.json();

    expect(body.data.sources).toMatchObject({
      camera_url: "https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8",
      cam_kind: "hls",
      embed_allowed: true,
      cam_open_url: null,
      cam_thumbnail_url:
        "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
    });
  });

  it("hides Surfline HLS cams but keeps the still when the playlist is unavailable", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 404,
    } as Response);
    const sourceChain = makeChain({
      data: {
        beach_id: VALID_BEACH_UUID,
        forecast_source_id: null,
        camera_url: "https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8",
        thumbnail_url:
          "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
      },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beach_sources") return sourceChain;
        if (table === "beach_dioramas") return dioramaChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await GET(
      {
        nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`),
      } as any,
      {
        params: Promise.resolve({ id: VALID_BEACH_UUID }),
      }
    );

    const body = await response.json();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8",
      expect.objectContaining({
        method: "HEAD",
        headers: expect.objectContaining({
          Referer: "https://www.surfline.com/",
        }),
      }),
    );
    expect(body.data.sources).toMatchObject({
      camera_url: null,
      cam_kind: "none",
      embed_allowed: null,
      cam_open_url: null,
      cam_thumbnail_url:
        "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
    });
  });

  it("resolves beach slugs before querying source and diorama rows", async () => {
    const beachLookupChain = makeChain({
      data: {
        id: VALID_BEACH_UUID,
      },
      error: null,
    });
    const sourceChain = makeChain({
      data: {
        beach_id: VALID_BEACH_UUID,
        forecast_source_id: "forecast-birdrock",
        camera_url: "https://cams.example/birdrock",
        thumbnail_url: null,
      },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beaches") return beachLookupChain;
        if (table === "beach_sources") return sourceChain;
        if (table === "beach_dioramas") return dioramaChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await GET(
      {
        nextUrl: new URL("https://www.quiversurf.app/api/beaches/birdrock/sources"),
      } as any,
      {
        params: Promise.resolve({ id: "birdrock" }),
      }
    );

    const body = await response.json();

    expect(beachLookupChain.eq).toHaveBeenCalledWith("slug", "birdrock");
    expect(sourceChain.eq).toHaveBeenCalledWith("beach_id", VALID_BEACH_UUID);
    expect(dioramaChain.eq).toHaveBeenCalledWith("beach_id", VALID_BEACH_UUID);
    expect(body.data.sources).toMatchObject({
      beach_id: VALID_BEACH_UUID,
      forecast_source_id: "forecast-birdrock",
      camera_url: "https://cams.example/birdrock",
    });
  });

  it("returns 404 for unknown beach slugs instead of a 500", async () => {
    const beachLookupChain = makeChain({ data: null, error: null });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beaches") return beachLookupChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await GET(
      {
        nextUrl: new URL("https://www.quiversurf.app/api/beaches/not-a-real-beach/sources"),
      } as any,
      {
        params: Promise.resolve({ id: "not-a-real-beach" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: "Beach not found",
    });
  });

  it("returns 400 for malformed identifiers before querying Supabase", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn(() => {
        throw new Error("Supabase should not be queried for malformed ids");
      }),
    });

    const response = await GET(
      {
        nextUrl: new URL("https://www.quiversurf.app/api/beaches/bird_rock/sources"),
      } as any,
      {
        params: Promise.resolve({ id: "bird_rock" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: "Invalid beach identifier",
    });
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("keeps database failures as 500 responses", async () => {
    const sourceChain = makeChain({
      data: null,
      error: new Error("database unavailable"),
    });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beach_sources") return sourceChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await GET(
      {
        nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`),
      } as any,
      {
        params: Promise.resolve({ id: VALID_BEACH_UUID }),
      }
    );

    expect(response.status).toBe(500);
  });
});

describe("GET /api/beaches/[id]/sources and the cam directory share one preflight", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function getSources(cameraUrl: string): Promise<Record<string, unknown>> {
    const sourceChain = makeChain({
      data: { beach_id: VALID_BEACH_UUID, forecast_source_id: null, camera_url: cameraUrl, thumbnail_url: null },
      error: null,
    });
    const dioramaChain = makeChain({ data: null, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => (table === "beach_sources" ? sourceChain : dioramaChain)),
    });
    const response = await GET(
      { nextUrl: new URL(`https://www.quiversurf.app/api/beaches/${VALID_BEACH_UUID}/sources`) } as any,
      { params: Promise.resolve({ id: VALID_BEACH_UUID }) },
    );
    return (await response.json()).data.sources;
  }

  it.each([
    ["https://www.earthcam.com/usa/hawaii/waikiki/beach/", true],
    ["https://www.earthcam.com/usa/hawaii/bigisland/waikoloa/", null],
  ])("keeps %s forecast-only on web while preserving native playback fields", async (cameraUrl, embedAllowed) => {
    const fetchMock = jest.spyOn(globalThis, "fetch");
    if (embedAllowed) {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    } else {
      fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    }
    const { resolveCamPlayback } = await import("@/lib/media/cam-embed-preflight");

    expect(await getSources(cameraUrl)).toMatchObject({
      web_cam_unavailable: true,
      camera_url: cameraUrl,
      cam_embed: { kind: "external", pageUrl: cameraUrl, provider: "earthcam.com" },
      embed_allowed: embedAllowed,
    });
    fetchMock.mockClear();
    await expect(resolveCamPlayback(cameraUrl)).resolves.toEqual({ kind: "none" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides the player and the directory card for a camera page that refuses HEAD (Cannon Beach)", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 405, headers: new Headers() } as Response);
    const { resolveCamPlayback } = await import("@/lib/media/cam-embed-preflight");
    const cameraUrl = "https://cbccstaff.net/whats-new/webcam/";

    // The native hero reads these fields; it must not offer a cam the web shows as none.
    expect(await getSources(cameraUrl)).toMatchObject({
      camera_url: null,
      cam_open_url: null,
      cam_thumbnail_url: null,
      cam_kind: "none",
      cam_embed: null,
      embed_allowed: false,
    });
    await expect(resolveCamPlayback(cameraUrl)).resolves.toEqual({ kind: "none" });
  });

  it.each([
    ["a player that denies framing (Galveston)", "https://v.angelcam.com/iframe?v=4oxyn1pr8v&autoplay=1", 404, { "x-frame-options": "DENY" }],
    ["a Surfline embed that answers 403 (Scripps)", "https://embed.cdn-surfline.com/cams/5834a0733421b20545c4b584/64ba68ebf1c960a93d1faba8f86cc16a3ed05913", 403, {}],
  ])("reports no cam to native for %s", async (_label, cameraUrl, status, headers) => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status, headers: new Headers(headers) } as Response);
    const { resolveCamPlayback } = await import("@/lib/media/cam-embed-preflight");

    expect(await getSources(cameraUrl)).toMatchObject({ camera_url: null, cam_kind: "none", cam_embed: null });
    await expect(resolveCamPlayback(cameraUrl)).resolves.toEqual({ kind: "none" });
  });

  it("keeps a camera page whose headers cannot be read, as the web player still tries it", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const { resolveCamPlayback } = await import("@/lib/media/cam-embed-preflight");
    const cameraUrl = "https://www.parks.ca.gov/sanonofre";

    expect(await getSources(cameraUrl)).toMatchObject({
      camera_url: cameraUrl,
      cam_kind: "iframe",
      embed_allowed: null,
      cam_embed: { kind: "external", pageUrl: cameraUrl, provider: "parks.ca.gov" },
    });
    await expect(resolveCamPlayback(cameraUrl)).resolves.toEqual({ kind: "inline" });
  });

  it("keeps a Surfline stream on both sides when its health check times out", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const { resolveCamPlayback } = await import("@/lib/media/cam-embed-preflight");
    const cameraUrl = "https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8";

    expect(await getSources(cameraUrl)).toMatchObject({ camera_url: cameraUrl, cam_kind: "hls" });
    await expect(resolveCamPlayback(cameraUrl)).resolves.toEqual({ kind: "inline" });
  });
});

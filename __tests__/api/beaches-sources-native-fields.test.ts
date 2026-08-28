import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "@/app/api/beaches/[id]/sources/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  it("marks Surfline report cam pages as external link-outs, not embeddable iframes", async () => {
    const sourceChain = makeChain({
      data: {
        beach_id: VALID_BEACH_UUID,
        forecast_source_id: null,
        camera_url:
          "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67",
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

    const body = await response.json();

    expect(body.data.sources).toMatchObject({
      camera_url:
        "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67",
      cam_open_url:
        "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67",
      cam_kind: "external",
      embed_allowed: false,
    });
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

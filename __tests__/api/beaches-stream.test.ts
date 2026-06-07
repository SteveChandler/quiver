/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/beaches/[id]/stream/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GET as resolveCamUrl } from "@/app/api/cam-resolve/route";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/app/api/cam-resolve/route", () => ({
  GET: jest.fn(),
}));

const mockCreateSupabaseServerClient = createSupabaseServerClient as jest.Mock;
const mockResolveCamUrl = resolveCamUrl as jest.Mock;

interface QueryChain {
  select: jest.Mock<QueryChain, [string]>;
  eq: jest.Mock<QueryChain, [string, unknown]>;
  maybeSingle: jest.Mock<Promise<unknown>, []>;
}

function makeChain(result: unknown): QueryChain {
  const chain = {} as QueryChain;
  chain.select = jest.fn<QueryChain, [string]>(() => chain);
  chain.eq = jest.fn<QueryChain, [string, unknown]>(() => chain);
  chain.maybeSingle = jest.fn<Promise<unknown>, []>(async () => result);
  return chain;
}

describe("GET /api/beaches/[id]/stream", () => {
  beforeEach(() => {
    mockCreateSupabaseServerClient.mockReset();
    mockResolveCamUrl.mockReset();
  });

  it("returns proxied HLS URLs for direct HLS camera sources", async () => {
    const sourceChain = makeChain({
      data: {
        camera_url:
          "https://hls.cdn-surfline.com/cam/12345/playlist.m3u8",
      },
      error: null,
    });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beach_sources") return sourceChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const request = new NextRequest(
      "https://www.quiversurf.app/api/beaches/beach-1/stream"
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "beach-1" }),
    });
    const body = await response.json();

    expect(body.data).toEqual({
      kind: "hls",
      stream_url:
        "/api/hls-proxy/hls.cdn-surfline.com/cam/12345/playlist.m3u8",
      page_url: null,
      provider: null,
    });
    expect(mockResolveCamUrl).not.toHaveBeenCalled();
  });

  it("resolves HDOnTap-style pages through the shared cam resolver", async () => {
    const sourceChain = makeChain({
      data: {
        camera_url: "https://www.obhotel.com/Webcam-Oceanbeach.php",
      },
      error: null,
    });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beach_sources") return sourceChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    mockResolveCamUrl.mockResolvedValue(
      Response.json({
        hlsUrl:
          "https://live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999",
      })
    );

    const request = new NextRequest(
      "https://www.quiversurf.app/api/beaches/ocean-beach/stream"
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "ocean-beach" }),
    });
    const body = await response.json();

    expect(mockResolveCamUrl).toHaveBeenCalledTimes(1);
    expect(body.data).toEqual({
      kind: "hls",
      stream_url:
        "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999",
      page_url: null,
      provider: null,
    });
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "@/app/api/beaches/[id]/sources/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data: unknown) => ({
    headers: { set: jest.fn() },
    json: async () => ({ success: true, data }),
  })),
  handleApiError: jest.fn((error: unknown) => {
    throw error;
  }),
}));

const mockCreateSupabaseServerClient = createSupabaseServerClient as jest.Mock;

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
        beach_id: "beach-1",
        ndbc_buoy_ids: ["46225"],
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
      nextUrl: new URL("https://www.quiversurf.app/api/beaches/beach-1/sources"),
    };

    const response = await GET(request as any, {
      params: Promise.resolve({ id: "beach-1" }),
    });

    const body = await response.json();

    expect(body.data.sources).toMatchObject({
      beach_id: "beach-1",
      ndbc_buoy_ids: ["46225"],
      forecast_source_id: "forecast-1",
      camera_url: "https://cams.example/blacks",
      cam_open_url: "https://cams.example/blacks",
      cam_thumbnail_url: "https://cams.example/blacks.jpg",
      cam_kind: expect.any(String),
    });
  });
});

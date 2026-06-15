/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/social-proof/route";
import { countRealSurfers } from "@/lib/social-proof/count-real-surfers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: jest.fn((handler) => handler),
  };
});

jest.mock("@/lib/social-proof/count-real-surfers", () => ({
  countRealSurfers: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

const mockCountRealSurfers = countRealSurfers as jest.MockedFunction<
  typeof countRealSurfers
>;
const mockCreateSupabaseServiceRoleClient =
  createSupabaseServiceRoleClient as jest.MockedFunction<
    typeof createSupabaseServiceRoleClient
  >;

function request(): NextRequest {
  return new NextRequest("https://www.quiversurf.app/api/social-proof");
}

describe("GET /api/social-proof", () => {
  beforeEach(() => {
    mockCountRealSurfers.mockReset();
    mockCreateSupabaseServiceRoleClient.mockReset();
    mockCreateSupabaseServiceRoleClient.mockReturnValue({ from: jest.fn() } as never);
  });

  it("returns live social proof counts with public cache headers", async () => {
    mockCountRealSurfers.mockResolvedValue({
      totalSurfers: 132,
      joinedLast7d: 31,
    });

    const response = await GET(request());

    await expect(response.json()).resolves.toEqual({
      totalSurfers: 132,
      joinedLast7d: 31,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=600, stale-while-revalidate=1200"
    );
    expect(mockCreateSupabaseServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(mockCountRealSurfers).toHaveBeenCalledWith(
      mockCreateSupabaseServiceRoleClient.mock.results[0]?.value
    );
  });

  it("falls back to zero counts if the data source fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockCountRealSurfers.mockRejectedValue(new Error("db unavailable"));

    const response = await GET(request());

    await expect(response.json()).resolves.toEqual({
      totalSurfers: 0,
      joinedLast7d: 0,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=30");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[social-proof] Failed to fetch social proof counts:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

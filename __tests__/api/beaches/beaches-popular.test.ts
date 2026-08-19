/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockIn = jest.fn();
const mockLimit = jest.fn();
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) =>
  beaches.filter((beach) => beach.id !== "held-beach"),
);

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withRateLimit: (handler: any) => handler,
  };
});

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

import { GET } from "@/app/api/beaches/popular/route";

describe("GET /api/beaches/popular", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockReturnValue({ in: mockIn });
    mockIn.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/beaches/popular/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("over-fetches RPC results before filtering held beaches and clamps output to 20", async () => {
    const beaches = [{ id: "beach-1", name: "Swami's" }];
    mockRpc.mockResolvedValue({ data: beaches, error: null });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/beaches/popular?limit=99")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age");
    expect(mockRpc).toHaveBeenCalledWith("get_popular_beaches", {
      p_limit: 25,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(body.data).toEqual(beaches);
  });

  it("falls back to well-known beach names when RPC is empty", async () => {
    const beaches = [{ id: "beach-2", name: "Pipeline" }];
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockLimit.mockResolvedValue({ data: beaches, error: null });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/beaches/popular?limit=2")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("beaches");
    expect(mockSelect).toHaveBeenCalledWith("id, name, slug, city, state");
    expect(mockIn).toHaveBeenCalledWith("name", expect.arrayContaining(["Pipeline"]));
    // The fallback reads the full bounded name list so held rows are removed before caching.
    expect(mockLimit).toHaveBeenCalledWith(8);
    expect(body.data).toEqual(beaches);
  });

  it("does not return a held beach from the popularity ranking", async () => {
    const beaches = [
      { id: "held-beach", name: "Held Beach" },
      { id: "safe-beach", name: "Safe Beach" },
    ];
    mockRpc.mockResolvedValue({ data: beaches, error: null });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/beaches/popular"),
    );

    expect((await response.json()).data).toEqual([
      { id: "safe-beach", name: "Safe Beach" },
    ]);
    expect(mockRankBeaches).toHaveBeenCalledWith(beaches);
  });

  it("wraps fallback query errors", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockLimit.mockResolvedValue({
      data: null,
      error: new Error("fallback failed"),
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/beaches/popular")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Error fetching popular beaches");
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching popular beaches:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});

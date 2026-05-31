/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mockCreateSupabaseServerClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withRateLimit: (handler: any) => handler,
  };
});

import { GET } from "@/app/api/coast-pulse/summary/route";

describe("GET /api/coast-pulse/summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/coast-pulse/summary/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("returns validation error when coordinates are missing", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/coast-pulse/summary")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid or missing lat/lon parameters");
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns a wrapped 500 when setup fails after valid coordinates", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockCreateSupabaseServerClient.mockRejectedValue(new Error("setup failed"));

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/coast-pulse/summary?lat=32.7&lon=-117.2"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("setup failed");
    expect(consoleError).toHaveBeenCalledWith(
      "Coast pulse summary error:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
